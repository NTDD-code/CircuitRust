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

### 🚀 Key Features

| Feature | Description |
| :--- | :--- |
| 🛡️ **Verification-Driven** | Detects missing Flyback diodes, short circuits, reversed polarity, and floating pins *before* you power up. Prevents hardware destruction. |
| 📐 **Professional EDA Export** | Generates industry-standard KiCad Netlists (`.net`) with full electrical compliance. Skip the web schematics—go straight to professional PCB routing. |
| 🧠 **Semantic Validation** | Graph-based netlist resolver ensures all electrical connections are logically sound and compliant with circuit theory. |
| 👁️ **HECATE Vision Integration** | AI-powered reverse engineering: transform physical board photos into CircuitRust DSL code using computer vision. |

### 💻 DSL Example

```typescript
// 1. Define power domains and load components
const vcc   = Net.power(5.0);
const motor = Component.DCMotor();
const d_fly = Component.Diode({ model: "Schottky" });

// 2. Formal protection pattern (Inductive Load Protection)
connect(d_fly.cathode, motor.m_pos);
connect(d_fly.anode,   motor.m_neg);

// 3. System integration
connect(motor.m_pos, vcc);

// Output: Ready for KiCad export with full validation ✅
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

### 🚀 Tính năng nổi bật

| Tính năng | Mô tả |
| :--- | :--- |
| 🛡️ **Kiểm định an toàn** | Tự động phát hiện thiếu Flyback diode, đoản mạch, cực ngược và chân lơ lửng trước khi mạch chạy. Ngăn chặn cháy nổ. |
| 📐 **Xuất bản chuyên nghiệp** | Tạo file KiCad Netlist (`.net`) chuẩn công nghiệp với tuân thủ điện đầy đủ. Bỏ qua sơ đồ web thô sơ—nhảy thẳng vào PCB chuyên nghiệp. |
| 🧠 **Logic mạng lưới** | Bộ phân giải netlist dựa trên đồ thị, đảm bảo tất cả kết nối điện tuân theo lý thuyết mạch. |
| 👁️ **Tích hợp HECATE Vision** | AI thị giác máy tính: biến ảnh chụp bảng mạch thành code CircuitRust tự động. |

### 💻 Ví dụ mã nguồn

```typescript
// 1. Khởi tạo miền nguồn và linh kiện tải
const vcc   = Net.power(5.0);
const motor = Component.DCMotor();
const d_fly = Component.Diode({ model: "Schottky" });

// 2. Cấu trúc bảo vệ tải cảm (Flyback Protection)
connect(d_fly.cathode, motor.m_pos);
connect(d_fly.anode,   motor.m_neg);

// 3. Kết nối vào hệ thống
connect(motor.m_pos, vcc);

// Kết quả: Sẵn sàng xuất KiCad với xác thực đầy đủ ✅
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

### 🚀 核心特性

| 特性 | 说明 |
| :--- | :--- |
| 🛡️ **安全审计** | 自动检测缺少续流二极管、短路、反向接线或引脚悬空，避免硬件损毁。在电源接通前发现所有问题。 |
| 📐 **专业 EDA 导出** | 生成工业标准 KiCad 网表（`.net`），完全符合电气规范。无需网页原理图——直接进行专业 PCB 布线。 |
| 🧠 **网表解析** | 基于图论的网表解析器，确保所有电路连接在逻辑上完全正确并符合电路理论。 |
| 👁️ **HECATE 视觉集成** | AI 计算机视觉：将物理电路板照片自动逆向工程为 CircuitRust DSL 代码。 |

### 💻 代码示例

```typescript
// 1. 定义电源域和负载元件
const vcc   = Net.power(5.0);
const motor = Component.DCMotor();
const d_fly = Component.Diode({ model: "Schottky" });

// 2. 感性负载保护模式（续流二极管）
connect(d_fly.cathode, motor.m_pos);
connect(d_fly.anode,   motor.m_neg);

// 3. 接入系统电源
connect(motor.m_pos, vcc);

// 输出: 可导出为 KiCad，已完全验证 ✅
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
