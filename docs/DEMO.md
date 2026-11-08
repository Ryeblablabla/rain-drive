# 纯演示录制

演示按顺序展示纯电驱和六缸发动机。每段分别打开游戏、选择声音模式并录制 Canvas 与实际 Web Audio 主输出，然后首尾相接。没有把两种车辆声浪混在一起，也不添加字幕、标题、说明或片尾。

先构建并启动游戏。在项目目录设置 `GAME_URL` 为游戏本地地址，运行：

```sh
node tests/record-demo.mjs
```

默认将两段 WebM、截图与驾驶状态证据保存到 `test-results/demo`；可用 `QA_OUTPUT` 更改目录。录制分辨率为 1920×1080，关闭音乐与导航语音，隐藏额外界面。车内实体仪表和道路标牌保留。电驱段验证燃烧通道静音及零机械换挡声；六缸段验证电驱通道静音、六挡加速及至少五次换挡。

安装 FFmpeg 与 Python 后拼接：

```sh
python tests/render-demo.py --input test-results/demo --output test-results/video
```

FFmpeg 不在 PATH 时通过 `--ffmpeg` 指定其位置。脚本输出 H.264 / AAC 视频与纯画面封面，并检查音量、分辨率和时长。仅有片段开头与结尾的短淡入淡出，音轨不交叉重叠。

录制会增加渲染开销。导出容器为 60 FPS，不代表所有录制帧均是独立渲染的新帧；实际游戏帧率见录制状态记录。连续运行验收单独执行 `tests/acceptance.mjs`。
