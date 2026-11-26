#!/usr/bin/env bash
# Build the test site of this pack in a DDEV project: Vikunja's own image on the project's own MariaDB, every account
# made by Vikunja's own command (its password through a pseudo-terminal, never on a command line), the project Webship
# site shared with them in their permissions, and the sample content the features read (two tasks, a label, an
# assignee, a comment, the board). It is what CI runs; on a machine with Docker, DDEV, `script` (util-linux) and 1 GB
# of free memory it makes the same site. As the Webship Workspace's builder does for a test site, it allows 100
# requests a minute before a login from one address (Vikunja's own is 10): a suite logs in more often than a person.
#
#   SITE_DIR=<folder>        where the project goes (default: ../vikunja-site beside the pack)
#   RELEASE=<X.Y.Z>          the release of the image (default: 2.8.0)
#   COUNTS_ONLY=1            build nothing: print what the site holds, one count a line (a run must leave them)
#   TIDY_ONLY=1              build nothing: remove the tasks a stopped run left ("Webship test …" of the suite's
#                            accounts in Webship site), with what Vikunja keeps of them
#
# The site answers at https://vikunjasteps.ddev.site, the address cucumber.js opens by default. Its own values (its
# secret) are made for it, in $SITE_DIR/vikunja/env, never printed. The site script (site/vikunja-site.php) is the one
# of the Webship Workspace's Vikunja plugin: it runs with PHP in the project's web container, as Vikunja's image has no
# shell, and reaches Vikunja's API and the project's database from there.
set -euo pipefail

PACK="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE_DIR="${SITE_DIR:-${PACK}/../vikunja-site}"
NAME=vikunjasteps
RELEASE="${RELEASE:-2.8.0}"
IMAGE="docker.io/vikunja/vikunja:${RELEASE}"
PASSWORD='dD.123123ddd'

# The site script, in the project's web container; its input reaches it.
site() {
  docker exec -i -u "$(id -u):$(id -g)" "ddev-${NAME}-web" php /var/www/html/vikunja/vikunja-site.php "$@"
}

if [ "${COUNTS_ONLY:-}" = 1 ] ; then
  site counts < /dev/null | grep -E '^[a-z ]+: [0-9]+$'
  exit 0
fi
if [ "${TIDY_ONLY:-}" = 1 ] ; then
  site tidy < /dev/null
  exit 0
fi

command -v script > /dev/null || { echo "The accounts need script (util-linux): Vikunja's own command takes a password from a terminal only." ; exit 1 ; }

# One of Vikunja's own commands, in its container (its image has no shell: the binary runs by itself).
vikunja() {
  docker exec "ddev-${NAME}-vikunja" /app/vikunja/vikunja "$@"
}

# One of Vikunja's own commands that asks a password (twice): the password through a pseudo-terminal, from a file only
# its owner reads, which goes right after. What the command says is shown when it fails; the terminal does not echo
# the password.
vikunja_password() {
  local password="$1" ; shift
  local file ; file="$(umask 077 && mktemp)"
  printf '%s\n%s\n' "${password}" "${password}" > "${file}"
  local quoted ; quoted="$(printf '%q ' docker exec -it "ddev-${NAME}-vikunja" /app/vikunja/vikunja "$@")"
  local said status=0
  said="$(script -q -e -c "${quoted}" /dev/null < "${file}" 2>&1)" || status=$?
  rm -f "${file:?}"
  [ "${status}" -eq 0 ] || printf '%s\n' "${said}" | tr -d '\r' | grep -v 'Password: *$' | tail -n 3 >&2
  return "${status}"
}

# An account: made, or its password back when it is there; then active, as Vikunja, its mailer on, would wait for the
# account to confirm its address.
account() {
  local login="$1"
  if vikunja user list 2>/dev/null | grep -qE "│ *[0-9]+ *│ *${login} *│" ; then
    vikunja_password "${PASSWORD}" user reset-password "${login}" --direct
  else
    vikunja_password "${PASSWORD}" user create --username "${login}" --email "${login}@example.com"
  fi
  vikunja user change-status "${login}" --enable > /dev/null
}

secret() { head -c 200 /dev/urandom | base64 -w0 | tr -dc 'A-Za-z0-9' | head -c "$1" ; }

mkdir -p "${SITE_DIR}/vikunja/files" "${SITE_DIR}/.ddev"
SITE_DIR="$(cd "${SITE_DIR}" && pwd)"
cd "${SITE_DIR}"
# MariaDB 11.4, as the Webship Workspace builds Vikunja (Vikunja supports MySQL, MariaDB, PostgreSQL and SQLite).
ddev config --project-type=generic --project-name="${NAME}" --database=mariadb:11.4 < /dev/null

cp "${PACK}/site/vikunja-site.php" vikunja/
( umask 077
  cat > vikunja/env <<ENVEOF
VIKUNJA_RELEASE=${RELEASE}
VIKUNJA_SERVICE_PUBLICURL=https://${NAME}.ddev.site/
VIKUNJA_SERVICE_SECRET=$(secret 64)
VIKUNJA_SERVICE_ENABLEREGISTRATION=false
VIKUNJA_SERVICE_TIMEZONE=UTC
VIKUNJA_DATABASE_TYPE=mysql
VIKUNJA_DATABASE_HOST=db
VIKUNJA_DATABASE_USER=db
VIKUNJA_DATABASE_PASSWORD=db
VIKUNJA_DATABASE_DATABASE=db
VIKUNJA_MAILER_ENABLED=true
VIKUNJA_MAILER_HOST=web
VIKUNJA_MAILER_PORT=1025
VIKUNJA_MAILER_AUTHTYPE=plain
VIKUNJA_MAILER_USERNAME=
VIKUNJA_MAILER_PASSWORD=
VIKUNJA_MAILER_SKIPTLSVERIFY=true
VIKUNJA_MAILER_FORCESSL=false
VIKUNJA_MAILER_FROMEMAIL=vikunja@example.com
VIKUNJA_RATELIMIT_NOAUTHLIMIT=100
ENVEOF
)
printf 'VIKUNJA_IMAGE=%s\n' "${IMAGE}" > .ddev/.env
cat > .ddev/docker-compose.vikunja.yaml <<'YAMLEOF'
# Vikunja: its own image on the project's MariaDB, at the project's address, as the host user; the project's web
# container keeps the mail catcher. The same service as the Webship Workspace's Vikunja plugin.
services:
  web:
    environment:
      - HTTP_EXPOSE=8093:80,8025:8025
      - HTTPS_EXPOSE=8457:80,8026:8025
  vikunja:
    image: "${VIKUNJA_IMAGE:-docker.io/vikunja/vikunja:2.8.0}"
    container_name: ddev-${DDEV_SITENAME}-vikunja
    labels:
      com.ddev.site-name: ${DDEV_SITENAME}
      com.ddev.approot: ${DDEV_APPROOT}
    restart: "no"
    user: "${DDEV_UID}:${DDEV_GID}"
    expose:
      - "3456"
    depends_on:
      db:
        condition: service_healthy
    env_file:
      - ${DDEV_APPROOT}/vikunja/env
    volumes:
      - ${DDEV_APPROOT}/vikunja/files:/app/vikunja/files
    environment:
      VIRTUAL_HOST: ${DDEV_HOSTNAME}
      HTTP_EXPOSE: "80:3456"
      HTTPS_EXPOSE: "443:3456"
YAMLEOF

echo "Starting Vikunja ${RELEASE}."
ddev start -y < /dev/null
code=''
for attempt in $(seq 1 100) ; do
  code="$(ddev exec "curl -s -o /dev/null -m 10 -w '%{http_code}' http://vikunja:3456/api/v1/info" < /dev/null 2>/dev/null | tr -d '\r' | tail -1 || true)"
  [ "${code}" = 200 ] && break
  [ "${attempt}" = 100 ] && { echo "Vikunja did not answer (${code:-none})." ; ddev logs -s vikunja --tail 80 < /dev/null || true ; exit 1 ; }
  sleep 3
done

# The accounts of the suite, each by Vikunja's own command, then their names, and the sample content: the project
# Webship site of owner, shared with member (read & write) and reader (read only), not with stranger.
for login in owner member reader stranger ; do account "${login}" ; done
payload() {
  python3 - "${PASSWORD}" <<'PYEOF'
import base64, json, sys
password = sys.argv[1]
rows = [{'login': login, 'mail': login + '@example.com', 'password': password, 'name': login.capitalize() + ' Test', 'role': role, 'action': ''}
        for login, role in [('owner', 'owner'), ('member', 'write'), ('reader', 'read'), ('stranger', '')]]
print(base64.b64encode(json.dumps({'admin': {'login': '', 'password': ''}, 'rows': rows}).encode()).decode())
PYEOF
}
payload | site accounts
payload | site content
site list < /dev/null

echo "The site: https://${NAME}.ddev.site (Vikunja $(site version < /dev/null | sed -n 's/^VERSION //p'))"
[ -n "${GITHUB_ENV:-}" ] && echo "LAUNCH_URL=https://${NAME}.ddev.site" >> "${GITHUB_ENV}"
exit 0
