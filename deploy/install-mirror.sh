#!/bin/sh
# Run as root on likh with the uploaded deployment bundle as the only argument.
set -eu
bundle=$1
account=inknote-release
id "$account" >/dev/null 2>&1 || useradd --create-home --shell /bin/sh "$account"
install -d -m 755 /opt/inknote-release-mirror
install -m 755 "$bundle/release_mirror.py" /opt/inknote-release-mirror/release_mirror.py
install -d -o "$account" -g "$account" -m 755 /srv/inknote-downloads
install -d -m 755 /home/inknote-release/.ssh
# Root owns the forced-command key; the upload account cannot loosen its restrictions.
receiver='/usr/bin/python3 /opt/inknote-release-mirror/release_mirror.py receive'
awk -v command="$receiver" '{print "restrict,command=\"" command "\" " $0}' "$bundle/mirror-key.pub" > "$bundle/authorized_keys"
install -o root -g root -m 644 "$bundle/authorized_keys" /home/inknote-release/.ssh/authorized_keys
install -m 644 "$bundle/inknote-release-sync.service" /etc/systemd/system/inknote-release-sync.service
install -m 644 "$bundle/inknote-release-sync.timer" /etc/systemd/system/inknote-release-sync.timer
install -m 644 "$bundle/downloads.nginx.conf" /www/server/panel/vhost/nginx/extension/inknote.likh.cn/downloads.conf
/www/server/nginx/sbin/nginx -t
/www/server/nginx/sbin/nginx -s reload
systemctl daemon-reload
systemctl enable --now inknote-release-sync.timer
