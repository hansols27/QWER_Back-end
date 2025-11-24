#!/bin/bash
SERVICE_NAME=qwerfansite-api.service

echo "> 기존 Systemd 서비스 중지 시작: $SERVICE_NAME"

# 서비스가 실행 중인지 확인하고, 실행 중일 경우에만 중지합니다.
if systemctl is-active $SERVICE_NAME; then
    systemctl stop $SERVICE_NAME
    echo "서비스 중지 완료."
else
    echo "서비스가 실행 중이 아닙니다. 중지 스킵."
fi