 CircuitRust 🦀

Hardware Design via Code — Safe, Verified, and Professional.

🌐 Navigation / Điều hướng / 导航

English | Tiếng Việt | 中文

🇺🇸 English

🎯 Overview

CircuitRust is a high-integrity Hardware Description DSL inspired by Rust's safety philosophy. It shifts circuit design from error-prone "drag-and-drop" interfaces to a Code-First workflow where electrical rules are enforced at compile-time.

🚀 Key Features

🛡️ Verification-Driven: Prevents hardware destruction by detecting missing Flyback diodes, short circuits, and floating pins before you power up.

📐 Professional EDA Export: Generates industry-standard KiCad Netlists (.net). Skip the web schematic—go straight to professional PCB routing.

🧠 Semantic Validation: Uses a graph-based netlist resolver to ensure electrical connectivity is logically sound.

💻 DSL Example

// Define components and nets
let vcc = Net::power(5.0);
let motor = Component::DCMotor;
let d_fly = Component::Diode { model: "Schottky" };

// Formal protection pattern (Flyback protection)
connect!(d_fly.cathode => motor.m_pos);
connect!(d_fly.anode => motor.m_neg);

// System integration
connect!(motor.m_pos => vcc);


🇻🇳 Tiếng Việt

🎯 Tổng quan

CircuitRust là ngôn ngữ thiết kế phần cứng (DSL) lấy cảm hứng từ triết lý an toàn của Rust. Dự án chuyển đổi quy trình thiết kế mạch từ việc "kéo thả" dễ sai sót sang quy trình Ưu tiên Mã nguồn (Code-First), nơi các quy tắc điện tử được kiểm tra nghiêm ngặt ngay khi biên dịch.

🚀 Tính năng nổi bật

🛡️ Kiểm định an toàn (Safety Audit): Ngăn chặn cháy nổ bằng cách tự động phát hiện thiếu Diode bảo vệ (Flyback), đoản mạch và chân lơ lửng.

📐 Xuất bản chuyên nghiệp: Xuất file KiCad Netlist (.net) chuẩn xác. Đừng quan tâm đến schematic thô sơ trên web—hãy dùng code để tạo ra bản vẽ PCB chuyên nghiệp trong KiCad.

🧠 Logic mạng lưới (Netlist Graph): Sử dụng thuật toán đồ thị để xác thực toàn bộ kết nối điện học thay vì so khớp dòng lệnh đơn giản.

💻 Ví dụ mã nguồn

let vcc = Net::power(5.0);
let motor = Component::DCMotor;
let d_fly = Component::Diode;

// Thiết lập cặp bảo vệ tải cảm (Flyback Diode)
connect!(d_fly.cathode => motor.m_pos);
connect!(d_fly.anode => motor.m_neg);

// Kết nối vào hệ thống
connect!(motor.m_pos => vcc);


🇨🇳 中文

🎯 项目简介

CircuitRust 是一款受 Rust 安全哲学启发的硬件描述语言 (DSL)。它将电路设计从易出错的“拖拽式”界面转变为代码优先 (Code-First) 的工作流，在编译阶段即强制执行电气规则。

🚀 核心特性

🛡️ 安全审计: 自动检测感性负载是否缺少续流二极管、是否存在短路或引脚悬空，避免硬件损毁。

📐 专业 EDA 导出: 生成工业标准的 KiCad 网表 (.net)。无需依赖简陋的网页预览，直接进入 KiCad 进行专业 PCB 布线。

🧠 网表解析: 基于图论的网表解析器，确保电路连接在逻辑上完全正确。

🛠 Workflow / Quy trình / 工作流程

Define ✍️

Write your circuit logic in CircuitRust DSL.

Verify ✅

Compiler runs a Safety Audit to find electrical violations.

Export 📤

Download the verified KiCad Netlist.

Manufacture 🏭

Import into KiCad PCB Editor for professional production.

📄 License

Licensed under the MIT License.

Created with ❤️ by NTDD-code.
