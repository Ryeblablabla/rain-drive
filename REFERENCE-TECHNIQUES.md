# 神力科莎雨夜参考与本项目采用的方法

核查日期：2026-11-08。用户参考：[【神力科莎】在雨夜欣赏城市的美景](https://www.bilibili.com/video/BV1FXfTBTEhM/)，作者“装了翅膀的猪”。页面时长 18:28，说明仅“这几天把我跑爽了”，未见完整模组、车辆、天气或滤镜清单。

## 从视频直接观察到的目标

- 右舵 JDM 风格驾驶舱，橙红色速度 / 转速表，仪表台上三只辅助仪表；仪表有实体深度，方向盘位于仪表前。
- 座舱和城市暗部占比高，光源和仪表受控发亮；远近建筑、道路曲线与多层高架形成景深。
- 挡风玻璃有雨滴、水痕与刮刷，红色尾灯和街灯在湿路上反射。

不能仅凭这段画面确认某个 CSP / Pure / Sol 版本、具体 PP 滤镜、车辆声音包或地图。首都高 / SRP 是相关技术路线，但本视频的实际模组组合没有得到证实。

## 已由原始项目文档确认的机制

| 用户关注点 | 神力科莎 / CSP 文档的依据 | 本项目本版的实现 |
|---|---|---|
| 车内仪表 | [Analog instruments](https://github.com/ac-custom-shaders-patch/acc-extension-config/wiki/Cars-%E2%80%93-Analog-instruments) 把 RPM、水温等输入映射到指针节点角度，并可设置范围和 LUT | 实体表盘与指针；同一动力状态驱动指针、挡位和声音 |
| 引擎与换挡 | [Audio options](https://github.com/ac-custom-shaders-patch/acc-extension-config/wiki/Cars-%E2%80%93-Audio-options) 明确列出 ENGINE_INT_RPMS、ENGINE_INT_THROTTLE、GEAR_INT_STATE、传动和涡轮参数；还有独立雨刷事件 | 六缸燃烧合成读取 RPM / 油门 / 断油；换挡接合与泄压独立触发；风噪、胎噪和雨刷分层混音 |
| 夜间写实 | [CSP 官方页面](https://acstuff.club/patch/) 列有 Lighting FX 动态光源、Weather FX 天气、Extra FX 局部反射 / 间接光 / TAA，以及 Real Mirrors | 降低天空与座舱曝光、暖色路灯光区、PBR 车漆和 HDR 环境、实时湿路反射与后视镜；这些是本项目的近似实现，未包含完整 CSP 功能 |
| 雨水 | [Rain FX 配置](https://github.com/ac-custom-shaders-patch/acc-extension-config/blob/master/config/rain_fx.ini) 区分雨水贴图、雨滴撞击、玻璃雨滴受力和不同镜头雨滴设置 | 玻璃雨滴聚合流动、气流偏移、雨刷同步清水轨迹、重新积水和后景折射；世界雨线独立于玻璃水滴 |
| 内饰材质 | [Interior material library](https://github.com/ac-custom-shaders-patch/acc-extension-config/blob/master/config/cars/common/materials_interior.ini) 有数字屏幕、玻璃覆盖层等专用配置 | 皮革微细节、金属表圈、发光刻度、弱光中控；仍是自建内饰，细节密度有限 |
| 道路与城市 | [Shutoko Revival Project 官方网站](https://shutokorevivalproject.com/) 提供其首都高速公路项目与安装入口 | 保留虚构沿江高架；未导入或重新分发其地图 |

参考资料里的“音效库按转速和油门接收参数”不等于所有声音都能靠调节一个循环录音的音高做好。更高保真的做法通常需要怠速、不同转速、加载与卸载、进排气和传动的多组录音，再与车辆状态混合。本版只有真实雨声录音，引擎仍属原创合成，须诚实区分。

## 为什么不是装一个模组就完成

[CSP 官方要求](https://acstuff.club/patch/) 是已安装的 64 位 Assetto Corsa；[配置仓库](https://github.com/ac-custom-shaders-patch/acc-extension-config) 描述的配置作用于该游戏的车辆 / 赛道和扩展目录。本项目采用 Three.js，不能直接载入 CSP、KN5 赛道或 AC 音效库来获得相同效果；应借鉴输入参数、材质、光照、雨水和混音的组织方式，并使用可授权的素材。

如果唯一优先级是接近这段视频的完整效果，使用正版 Assetto Corsa、Content Manager / CSP、合适天气与后处理、精细车辆及城市地图，是更直接的路线。继续独立开发则需要持续提高地图与内饰资产、灯光调校、录音音效库及车辆模拟，不能把“加滤镜”当作全部工作。

## 无人工限速的具体含义

本项目移除了原来的 115 km/h 速度钳制。发动机输出经挡位、终传和传动效率转为轮上牵引力，减去随速度平方增加的空气阻力、滚动阻力、发动机制动及刹车，再积分得到车速。红线和齿比仍有物理意义；巡航设定、交通减速和碰撞也会影响车速。

独立无车动力仿真测得约 289.8 km/h 自然平衡速度、0–100 km/h 约 5.81 s。这是虚构车辆的模型结果，不是真实车型参数，也不是所有道路条件下的实车性能。游戏内高速与性能实测另见验收报告。
## 1.3：玻璃雨水的进一步分析

用户重点是水珠聚合、汇流、流下及高速冲散。参考视频能证明视觉目标，但无法证明其封闭实现的具体求解器；CSP rain_fx.ini 是配置依据，不是完整雨水算法源码。

| 可查阅的成熟方案 | 确认的机制 | 集成判断 |
|---|---|---|
| [raindrop-fx](https://github.com/SardineFish/raindrop-fx)（MIT） | simulator.ts 遍历九宫格碰撞；raindrop.ts 按质量合并并保留动量、随机阻力决定滑动、运动中分离低密度残留滴；高度/法线图用于折射 | 与当前 WebGL 方向接近；直接复制实时背景到第二个 WebGL 上下文会增加开销，本版把这些机制改写进现有 Three.js 合成器 |
| [Codrops RainEffect](https://github.com/codrops/RainEffect) | 大滴、微滴、运动拖尾和后景扭曲形成玻璃湿润层次 | 用作视觉研究；没有复制其成品模板或素材 |
| [librain](https://github.com/skiselkov/librain) | 面向 X-Plane；每块玻璃配置重力、风、推力作用点和系数，结合玻璃对象和遮挡处理 | 参数组织可参考；依赖 X-Plane SDK 和原生插件，不能直接作为此网页的即插即用模块 |

本版的实现顺序是：新滴撞击 → 小滴附着 → 邻滴合并积累质量 → 克服附着力粘滑 → 运动大滴留下薄水膜及小滴 → 高速气流向上/外侧拉伸和分裂 → 雨刷清除水滴和水膜 → 新雨重新积聚。合并按面积质量近似；分裂从母滴扣质量；蒸发、边缘排水和新雨补水是开放系统的质量变化。微滴池预留新雨容量，避免跑久后停止生成新撞击。

渲染使用实时水层高度梯度改变场景采样，水珠边缘的高光来自背景路灯与车灯；移动拖尾独立积累并消散，雨刷同时擦除。不是只在屏幕上盖循环雨滴视频。世界雨线、玻璃水滴、雨声和路面湿润各有独立职责。

仍有差距：没有三维曲面上的完整流体求解和接触角计算；大水流仍由粒子与低分辨率水膜近似，侧窗和凝结未实现；夜景高光的透镜形状和刮刷边缘积水还可继续提高。详见实际游戏和 verification 的重雨/高速截图，不以统计数值代替视觉质量判断。
