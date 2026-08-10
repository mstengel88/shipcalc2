#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run this script with sudo." >&2
  exit 1
fi

app_root="${SHIPCALC_ROOT:-/opt/ghos/apps/shipcalc2}"
backup_config="${GHOS_BACKUP_CONFIG:-/etc/ghos-backup}"
databases_file="$backup_config/databases.conf"
sources_file="$backup_config/source-paths.conf"
database_entry="shipcalc|/opt/ghos/compose.yml|postgres|shipcalc|shipcalc|postgres:16"

[[ -d "$app_root" ]] || { echo "ShipCalc app directory is missing: $app_root" >&2; exit 1; }
[[ -f "$databases_file" ]] || { echo "GHOS database backup config is missing: $databases_file" >&2; exit 1; }
[[ -f "$sources_file" ]] || { echo "GHOS source backup config is missing: $sources_file" >&2; exit 1; }

grep -Fqx "$database_entry" "$databases_file" || printf '%s\n' "$database_entry" >>"$databases_file"
grep -Fqx "$app_root" "$sources_file" || printf '%s\n' "$app_root" >>"$sources_file"

echo "ShipCalc database and application files are registered with GHOS backup."
echo "Run: sudo systemctl start ghos-backup.service"
