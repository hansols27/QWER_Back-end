#!/bin/bash
SERVICE_NAME=qwerfansite-api.service

echo "> Systemd 서비스 재시작 시작: $SERVICE_NAME"

# 중지-설치-갱신이 완료되었으므로, 새 코드를 적용하여 서비스를 재시작합니다.
systemctl restart $SERVICE_NAME

echo "> 서비스 재시작 완료."