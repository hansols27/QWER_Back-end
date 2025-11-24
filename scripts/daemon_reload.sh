#!/bin/bash
echo "> Systemd Daemon Reload 실행"
# CodeDeploy가 파일을 복사했으므로, systemctl에게 설정이 변경되었음을 알립니다.
systemctl daemon-reload
echo "> Systemd Daemon Reload 완료."