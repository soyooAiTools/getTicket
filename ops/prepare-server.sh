#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="${1:-/srv/ticketing-beta}"

sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin nginx curl jq rsync
sudo systemctl enable docker
sudo systemctl start docker

sudo mkdir -p \
  "${BASE_DIR}/releases" \
  "${BASE_DIR}/shared/backups" \
  "${BASE_DIR}/ops" \
  /var/www/certbot

sudo chown -R "$USER":"$USER" "${BASE_DIR}"
