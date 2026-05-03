🦀 CircuitRust
English | Tiếng Việt | 中文

CircuitRust is a powerful Rust-based Domain Specific Language (DSL) for circuit design, safety validation, and professional netlist export. Move beyond "drag-and-drop" UI; define your hardware with code.

🇺🇸 English
🚀 Key Features
Circuit-as-Code: Define components and connections using clear, expressive Rust-like syntax.

🔥 Safety Audit Engine: * Automatic Flyback Diode detection for inductive loads (Motors, Buzzers).

Short Circuit alerts (e.g., 3.3V/5V direct to GND).

Floating Pin detection.

🔌 KiCad Integration: Export precision .net files ready for KiCad PCB Editor.

BOM Generation: Automatically generate a Bill of Materials.

💻 Code Example
Rust
let vcc = Net::power(5.0);
let buzzer = Component::Buzzer;
let d_fly = Component::Diode { model: "Schottky" };

// Clamp flyback diode in parallel to the load
connect!(d_fly.cathode => buzzer.vcc);
connect!(d_fly.anode => buzzer.gnd);
🇻🇳 Tiếng Việt
🚀 Tính năng nổi bật
Circuit-as-Code: Định nghĩa linh kiện và kết nối bằng mã nguồn thay vì kéo thả.

🔥 Safety Audit Engine: Tự động kiểm tra lỗi thiếu Diode bảo vệ, đoản mạch và chân lơ lửng.

🔌 Tích hợp KiCad: Xuất file netlist chuẩn xác để làm PCB chuyên nghiệp trong KiCad.

BOM Generation: Tự động thống kê danh mục linh kiện.

💻 Ví dụ
Rust
// Kết nối Diode bảo vệ (Flyback) cho Buzzer
connect!(d_fly.cathode => buzzer.vcc);
connect!(d_fly.anode => buzzer.gnd);
🇨🇳 中文
🚀 核心特性
代码即电路 (Circuit-as-Code): 使用清晰的 Rust 风格语法定义元器件和逻辑连接。

🔥 安全审计引擎: * 自动检测感性负载（电机、蜂鸣器）是否缺少续流二极管。

短路警告（如电源直接接地）。

悬空引脚检测。

🔌 KiCad 集成: 导出精准的 .net 网表文件，可直接导入 KiCad 进行 PCB 布线。

BOM 自动生成: 自动生成物料清单。

💻 代码示例
Rust
let vcc = Net::power(5.0);
let buzzer = Component::Buzzer;
let d_fly = Component::Diode { model: "Schottky" };

// 并联续流二极管以保护电路
connect!(d_fly.cathode => buzzer.vcc);
connect!(d_fly.anode => buzzer.gnd);
🛠 Workflow / 工作流程
Code: Define your circuit.

Compile: Validate safety and logic.

Export: Get the KiCad Netlist.

Layout: Route your PCB professionally.

📄 License
This project is licensed under the MIT License.
