<div align="center">

<!-- Dynamic Banner with Wave Animation -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=8B5CF6&height=200&section=header&text=CircuitRust&fontSize=70&fontColor=ffffff&animation=fadeIn&desc=Hardware%20Design%20via%20Code" width="100%" />

<br/>

<!-- Badges -->
<img src="https://img.shields.io/badge/language-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
<img src="https://img.shields.io/badge/AI_Engine-HECATE-8B5CF6?style=for-the-badge&logo=sparkles&logoColor=white" alt="HECATE AI">
<img src="https://img.shields.io/badge/EDA-KiCad-005AA0?style=for-the-badge&logo=kicad&logoColor=white" alt="KiCad">
<img src="https://img.shields.io/badge/license-MIT-28A745?style=for-the-badge" alt="MIT License">
<img src="https://img.shields.io/badge/status-Active-brightgreen?style=for-the-badge" alt="Status">

# 🦀 CircuitRust
## **Stop Guessing. Start Compiling.**

<p>
  <i>A high-integrity Hardware Description DSL inspired by Rust's safety philosophy.</i><br>
  <b>Safe, Verified, and Professional.</b>
</p>

### 🌍 Navigation / Điều hướng / 导航
[🇺🇸 English](#-english) | [🇻🇳 Tiếng Việt](#-tiếng-việt) | [🇨🇳 中文](#-中文)

---

</div>

## 🇺🇸 English

> *"If your circuit has the potential to smoke, it should not compile."*

### 🎯 Overview

**CircuitRust** is a high-integrity Hardware Description DSL that revolutionizes circuit design. It shifts the workflow from error-prone "drag-and-drop" interfaces to a **Code-First** paradigm where strict electrical rules and safety checks are enforced at compile-time—just like Rust enforces memory safety.

> 📝 **CircuitRust DSL** is inspired by Rust syntax (using `::` scope resolution, macros with `!`, and pattern matching), making it familiar to Rust developers while maintaining domain-specific circuit design semantics.

### 🚀 Key Features

| Feature | Description |
| :--- | :--- |
| 🛡️ **Verification-Driven** | Detects missing Flyback diodes, short circuits, reversed polarity, and floating pins *before* you power up. Prevents hardware destruction. |
| 📐 **Professional EDA Export** | Generates industry-standard KiCad Netlists (`.net`) with full electrical compliance. Skip the web schematics—go straight to professional PCB routing. |
| 🧠 **Semantic Validation** | Graph-based netlist resolver ensures all electrical connections are logically sound and compliant with circuit theory. |
| 👁️ **HECATE Vision Integration** | AI-powered reverse engineering: transform physical board photos into CircuitRust DSL code using computer vision. |

### 💻 DSL Example

```circuit-dsl
// Simple LED circuit with current-limiting resistor
let vcc = Net::power(5.0);
let gnd = Net::ground();

let r1 = Component::Resistor { resistance: "220" };
let led1 = Component::LED { color: "red" };

connect!(vcc => r1.pin1);
connect!(r1.pin2 => led1.anode);
connect!(led1.cathode => gnd);
```

### 💻 Advanced Example: Inductive Load Protection

```circuit-dsl
// DC Motor circuit with Flyback diode protection
let vcc = Net::power(5.0);
let gnd = Net::ground();

let motor = Component::DCMotor;
let d_fly = Component::Diode { model: "Schottky" };

// Formal protection pattern (Flyback protection)
connect!(d_fly.cathode => motor.m_pos);
connect!(d_fly.anode => motor.m_neg);

// System integration
connect!(motor.m_pos => vcc);
connect!(motor.m_neg => gnd);

// ✅ Compiler validates: Flyback diode present ✓
```

### 🛠️ Workflow

```
┌─────────────────────────────────────────────────────┐
│                  CIRCUITRUST PIPELINE               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ✍️  Write  →  ✅ Verify  →  📤 Export  →  🏭 Build  │
│                                                     │
│  Code-first    Safety Audit   KiCad Netlist  PCB   │
│  DSL circuit   Electrical     Industry-std  Layout │
│  definition    Compliance     Format        & MFG  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 📋 Quick Start

1. **Define your circuit** in CircuitRust DSL
2. **Compile & verify** — automatic electrical safety checks
3. **Export as KiCad** — `.net` netlist for professional PCB design
4. **Manufacture** — no surprises, no smoke tests needed!

### 🔗 Links
- 📖 [Documentation](#) — Coming Soon
- 🐛 [Report Issues](#) — GitHub Issues
- 💬 [Discussions](#) — GitHub Discussions

---

## 🇻🇳 Tiếng Việt

> *"Nếu mạch của bạn có nguy cơ bốc khói, nó sẽ không được biên dịch."*

### 🎯 Tổng quan

**CircuitRust** là một ngôn ngữ thiết kế phần cứng (DSL) cấp cao với triết lý an toàn từ Rust. Nó chuyển đổi quy trình thiết kế từ "kéo thả" dễ sai sang phương pháp **Code-First**, nơi mọi quy tắc điện tử được kiểm tra nghiêm ngặt ngay lúc biên dịch.

> 📝 **CircuitRust DSL** lấy cảm hứng từ cú pháp Rust (dùng `::` scope resolution, macro với `!`, pattern matching), giúp nhà phát triển Rust dễ làm quen nhưng vẫn giữ ngữ nghĩa thiết kế mạch điều khiển.

### 🚀 Tính năng nổi bật

| Tính năng | Mô tả |
| :--- | :--- |
| 🛡️ **Kiểm định an toàn** | Tự động phát hiện thiếu Flyback diode, đoản mạch, cực ngược và chân lơ lửng trước khi mạch chạy. Ngăn chặn cháy nổ. |
| 📐 **Xuất bản chuyên nghiệp** | Tạo file KiCad Netlist (`.net`) chuẩn công nghiệp với tuân thủ điện đầy đủ. Bỏ qua sơ đồ web thô sơ—nhảy thẳng vào PCB chuyên nghiệp. |
| 🧠 **Logic mạng lưới** | Bộ phân giải netlist dựa trên đồ thị, đảm bảo tất cả kết nối điện tuân theo lý thuyết mạch. |
| 👁️ **Tích hợp HECATE Vision** | AI thị giác máy tính: biến ảnh chụp bảng mạch thành code CircuitRust tự động. |

### 💻 Ví dụ mã nguồn

```circuit-dsl
// Mạch LED đơn giản với điện trở giới hạn dòng
let vcc = Net::power(5.0);
let gnd = Net::ground();

let r1 = Component::Resistor { resistance: "220" };
let led1 = Component::LED { color: "red" };

connect!(vcc => r1.pin1);
connect!(r1.pin2 => led1.anode);
connect!(led1.cathode => gnd);
```

### 💻 Ví dụ nâng cao: Bảo vệ tải cảm

```circuit-dsl
// Mạch động cơ DC với Flyback diode
let vcc = Net::power(5.0);
let gnd = Net::ground();

let motor = Component::DCMotor;
let d_fly = Component::Diode { model: "Schottky" };

// Cấu trúc bảo vệ Flyback
connect!(d_fly.cathode => motor.m_pos);
connect!(d_fly.anode => motor.m_neg);

// Kết nối hệ thống
connect!(motor.m_pos => vcc);
connect!(motor.m_neg => gnd);

// ✅ Trình biên dịch kiểm tra: Flyback diode đã có ✓
```

### 🛠️ Quy trình

```
┌─────────────────────────────────────────────────────┐
│              QUY TRÌNH CIRCUITRUST                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ✍️  Viết  →  ✅ Kiểm  →  📤 Xuất  →  🏭 Sản xuất  │
│                                                     │
│  Code DSL   Audit an   KiCad Netlist  PCB Layout   │
│  mạch điện  toàn + Lỗi chuẩn công      & Thiết kế  │
│             điện học   nghiệp                      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 📋 Bắt đầu nhanh

1. **Mô tả mạch** bằng CircuitRust DSL
2. **Biên dịch & kiểm tra** — xác thực điện tự động
3. **Xuất KiCad** — netlist `.net` cho thiết kế PCB chuyên nghiệp
4. **Sản xuất** — không bất ngờ, không cần test khói!

### 🔗 Liên kết
- 📖 [Tài liệu](#) — Sắp ra mắt
- 🐛 [Báo cáo lỗi](#) — GitHub Issues
- 💬 [Thảo luận](#) — GitHub Discussions

---

## 🇨🇳 中文

> *"如果你的电路有冒烟的风险，它就不应该被编译。"*

### 🎯 项目简介

**CircuitRust** 是一款受 Rust 安全哲学启发的硬件描述语言（DSL）。它将电路设计从易出错的"拖拽式"界面转变为**代码优先（Code-First）**的工作流，在编译阶段即强制执行电气规则与安全检查。

> 📝 **CircuitRust DSL** 采用 Rust 风格的语法（包括 `::` 作用域解析、`!` 宏与模式匹配），使 Rust 开发者容易上手，同时保留电路设计的领域语义。

### 🚀 核心特性

| 特性 | 说明 |
| :--- | :--- |
| 🛡️ **安全审计** | 自动检测缺少续流二极管、短路、反向接线或引脚悬空，避免硬件损毁。在电源接通前发现所有问题。 |
| 📐 **专业 EDA 导出** | 生成工业标准 KiCad 网表（`.net`），完全符合电气规范。无需网页原理图——直接进行专业 PCB 布线。 |
| 🧠 **网表解析** | 基于图论的网表解析器，确保所有电路连接在逻辑上完全正确并符合电路理论。 |
| 👁️ **HECATE 视觉集成** | AI 计算机视觉：将物理电路板照片自动逆向工程为 CircuitRust DSL 代码。 |

### 💻 代码示例

```circuit-dsl
// 简单的 LED 电路（含限流电阻）
let vcc = Net::power(5.0);
let gnd = Net::ground();

let r1 = Component::Resistor { resistance: "220" };
let led1 = Component::LED { color: "red" };

connect!(vcc => r1.pin1);
connect!(r1.pin2 => led1.anode);
connect!(led1.cathode => gnd);
```

### 💻 高级示例：感性负载保护

```circuit-dsl
// 直流马达电路与续流二极管保护
let vcc = Net::power(5.0);
let gnd = Net::ground();

let motor = Component::DCMotor;
let d_fly = Component::Diode { model: "Schottky" };

// 续流二极管保护模式
connect!(d_fly.cathode => motor.m_pos);
connect!(d_fly.anode => motor.m_neg);

// 系统集成
connect!(motor.m_pos => vcc);
connect!(motor.m_neg => gnd);

// ✅ 编译器验证：续流二极管已配置 ✓
```

### 🛠 工作流程

```
┌─────────────────────────────────────────────────────┐
│              CIRCUITRUST 工作流程                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ✍️  编写  →  ✅ 验证  →  📤 导出  →  🏭 制造      │
│                                                     │
│  代码 DSL   安全审计   KiCad 网表   PCB 布线        │
│  电路描述   + 电气规则  工业标准    与生产          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 📋 快速开始

1. **用 CircuitRust DSL 描述电路**
2. **编译并验证** — 自动进行电气安全检查
3. **导出为 KiCad** — 专业 PCB 设计用的 `.net` 网表
4. **制造生产** — 无惊喜，无需烟雾测试！

### 🔗 链接
- 📖 [文档](#) — 即将推出
- 🐛 [报告问题](#) — GitHub Issues
- 💬 [讨论](#) — GitHub Discussions

---

<div align="center">

### 🌟 Why CircuitRust?

| Traditional EDA | CircuitRust |
|:---:|:---:|
| ❌ Manual rule checking | ✅ Automated verification |
| ❌ Design errors in PCB | ✅ Errors caught at compile-time |
| ❌ Days of debugging | ✅ Minutes to verified design |
| ❌ No version control | ✅ Git-friendly code |

---

## 📄 License

Licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

## 🙌 Contributing

We welcome contributions! Please check out our [Contributing Guidelines](#).

## 💬 Community

- 🐦 [Twitter](#) — Follow for updates
- 💻 [GitHub Discussions](#) — Ask questions
- 📧 [Email](#) — Contact us

---

**Created with ❤️ by NTDD-code**

⬆️ [Back to Top](#-circuitrust)

</div>
