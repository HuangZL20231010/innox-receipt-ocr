#!/usr/bin/env bash
#
# Innox 发票整理小助手 — 一键部署脚本
#
# 用法：
#   ./deploy.sh              构建并上传到服务器
#   ./deploy.sh --dry-run    试运行（不实际传输，看看会改动什么）
#
set -euo pipefail

# ====== 配置 ======
SERVER_USER="root"
SERVER_HOST="1.94.249.51"
SERVER_PATH="/www/wwwroot/amaztour/"
# ==================

# 颜色
B='\033[1;34m'    # 蓝
G='\033[0;32m'    # 绿
Y='\033[1;33m'    # 黄
R='\033[0;31m'    # 红
N='\033[0m'       # reset

# 切到脚本所在目录
cd "$(dirname "$0")"

# 解析参数
DRY_RUN=""
if [[ "${1:-}" == "--dry-run" || "${1:-}" == "-n" ]]; then
  DRY_RUN="--dry-run"
fi

echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo -e "${B}  Innox 发票整理小助手  部署脚本${N}"
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo -e "  目标：${Y}${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}${N}"
[[ -n "$DRY_RUN" ]] && echo -e "  模式：${Y}试运行（不实际传输）${N}"
echo

# 步骤 1：构建
echo -e "${B}==> [1/2] 构建生产产物 (npm run build)${N}"
T0=$(date +%s)
npm run build
BUILD_TIME=$(( $(date +%s) - T0 ))

if [[ ! -d dist ]]; then
  echo -e "${R}✗ dist/ 目录不存在，构建可能失败${N}"
  exit 1
fi
DIST_SIZE=$(du -sh dist | awk '{print $1}')
echo -e "${G}✓ 构建完成${N} dist/ = ${DIST_SIZE}, 耗时 ${BUILD_TIME}s"
echo

# 步骤 2：rsync 上传
echo -e "${B}==> [2/2] 同步到服务器 (rsync)${N}"
T1=$(date +%s)
rsync -avz --delete $DRY_RUN \
  --exclude='.user.ini' \
  --exclude='.well-known/' \
  --human-readable \
  dist/ "${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}"
SYNC_TIME=$(( $(date +%s) - T1 ))

echo
echo -e "${G}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
if [[ -n "$DRY_RUN" ]]; then
  echo -e "${Y}试运行结束 — 没有实际改动${N}"
  echo -e "  确认无误后去掉 --dry-run 再跑一次"
else
  echo -e "${G}✓ 部署成功！${N}  rsync 耗时 ${SYNC_TIME}s"
  echo -e "  浏览器强制刷新（${Y}Cmd+Shift+R${N} / ${Y}Ctrl+F5${N}）验证更新"
fi
echo -e "${G}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
