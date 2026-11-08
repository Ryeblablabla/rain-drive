# 素材与依赖来源

所有运行资源已随包保存，游戏运行不请求外部素材服务。

| 资源 | 来源 | 许可 | 使用方式 |
|---|---|---|---|
| Asphalt 02，1K diffuse / OpenGL normal | https://polyhaven.com/a/asphalt_02 | CC0，https://polyhaven.com/license | 沥青底色、细节法线及湿路面扰动 |
| Shanghai Bund，1K HDR | https://polyhaven.com/a/shanghai_bund | CC0，https://polyhaven.com/license | 经过 PMREM 预处理的车辆和金属环境光，不作为实景地图 |
| Rain drops — Gravity Sound | https://commons.wikimedia.org/wiki/File:Rain_drops_(Gravity_Sound).wav ，作者 https://www.gravitysound.studio/ | CC BY 4.0，https://creativecommons.org/licenses/by/4.0/ | 真实雨滴录音，原文件随包保存；播放时循环、降低高频并随雨量调节音量 |
| 座舱、高架、列车、远景补充建筑、指示牌 | 本项目自建几何与 Canvas 绘制 | 本项目原创 | 实时三维场景 |
| After Rain 夜行电台 | Web Audio 原创四和弦氛围合成 | 本项目原创，无第三方录音 | 车内音乐；也支持用户导入本地音频 |
| 补充风雨、胎噪、引擎、雨刷、接缝震动、周边车辆 | 本项目 Web Audio 合成 | 本项目原创 | 随驾驶状态实时调制；真实雨滴录音见上条 |
| 导航语音 | 浏览器 / Windows SpeechSynthesis | 用户系统语音组件 | 有中文系统语音时使用；声音取决于本机已装语音 |
| Three.js（含示例 Reflector / RGBELoader / RoundedBoxGeometry） | https://github.com/mrdoob/three.js | MIT，见 THIRD-PARTY-LICENSES.txt | 三维渲染与辅助组件 |
| TypeScript / Vite | https://github.com/microsoft/TypeScript / https://github.com/vitejs/vite | Apache-2.0 / MIT | 仅源码开发及构建工具，不需要安装到玩家电脑 |

这是虚构的沿江城市高架体验，未宣称复现上海实际道路、真实车型或实际导航路线。真实 HDR 仅用于照明。

## Car Concept 详细车模

- 作者：Eric Chadwick，Darmstadt Graphics Group GmbH，© 2024。
- 原始资源与许可说明：https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept
- GLB：https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CarConcept/glTF-Binary/CarConcept.glb
- CC BY 4.0：https://creativecommons.org/licenses/by/4.0/
- 原始 GLB 保存为 assets/concept-car.glb；模型和纹理由作者制作。Khronos / 3D Commerce 标识归各自权利方，不表示对本项目背书。
- 运行时修改：移除不可见的部分内部几何以减少绘制；按材质合并网格；缩放并调整朝向；简化透射和灯光强度，添加独立刹车灯。用于 25 辆道路交通车辆，不是玩家车辆的外观或真实车型授权。
- 当前引擎与换挡声音为本项目原创合成，不包含 Assetto Corsa、CSP 或其他游戏的录音。
## 1.3 真实城市、灯具和卡车

- 城市出典：国土交通省 Project PLATEAU / 東京都 3D 都市モデル，千代田区 2025 年 LOD2 textured 建筑数据。
- 官方目录 API：https://api.plateauview.mlit.go.jp/datacatalog/plateau-datasets （记录 id=13101_bldg_lod2，year=2025，texture=true）。本地 public/assets/tokyo/manifest.json 记录了 8 个原始瓦片与 tileset 地址。
- 数据许可入口：https://www.mlit.go.jp/plateau/site-policy/ 。官方公共数据利用规则 PDL1.0 兼容 CC BY 4.0，要求出典和修改声明；东京数据门户 https://www.geospatial.jp/ckan/dataset/plateau-tokyo23ku 亦指向该许可。版权属于相应地方公共团体。
- 修改声明：从 3D Tiles 提取内嵌 GLB、保留其几何和纹理、转换坐标和原点，调整夜间材质，重排为虚构道路两侧建筑。此加工场景由本项目制作，不是国土交通省发布的实际道路复现或官方导航资料。
- Security Light，Poly Haven：https://polyhaven.com/a/security_light ，CC0：https://polyhaven.com/license 。保留 1K GLTF、网格和贴图；缩放、调整方向，安装在本项目圆形灯杆及曲臂上。
- Cesium Milk Truck，Cesium © 2017，模型 CC BY 4.0：https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CesiumMilkTruck 。保留原始 GLB，运行时调整比例、朝向并补刹车灯；用于 5 辆车流卡车。Cesium 商标/标识归权利方所有，不代表背书。
- Google Draco，Apache-2.0：https://github.com/google/draco 。本地解码器用于读取上述 Draco 压缩城市几何，无需网络。
- raindrop-fx，SardineFish © 2021，MIT：https://github.com/SardineFish/raindrop-fx 。参考其质量合并、邻格碰撞、粘滑和残留滴机制，重写为本项目 Three.js 合成流程并加入气流与雨刷；保留 MIT 文本于 THIRD-PARTY-LICENSES.txt。未使用独立的 zogra 渲染器。
- Codrops RainEffect、librain 仅作技术研究，没有把其资源或原代码放入运行包。
