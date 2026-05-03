<div align="center">

<img src="https://img.shields.io/badge/language-Rust-orange?style=for-the-badge&logo=rust" alt="Rust">
<img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" alt="MIT License">
<img src="https://img.shields.io/badge/status-active-brightgreen?style=for-the-badge" alt="Active">
<img src="https://img.shields.io/badge/EDA-KiCad-blue?style=for-the-badge" alt="KiCad">

# 🦀 CircuitRust

### **Hardware Design via Code — Safe, Verified, and Professional.**

*A Hardware Description DSL inspired by Rust's safety philosophy.*

[🇺🇸 English](#-english) · [🇻🇳 Tiếng Việt](#-tiếng-việt) · [🇨🇳 中文](#-中文)

---

</div>

## 🇺🇸 English

### 🎯 Overview

**CircuitRust** is a high-integrity Hardware Description DSL inspired by Rust's safety philosophy. It shifts circuit design from error-prone "drag-and-drop" interfaces to a **Code-First** workflow where electrical rules are enforced at compile-time.

---

### 🚀 Key Features

| Feature | Description |
|---|---|
| 🛡️ **Verification-Driven** | Detects missing Flyback diodes, short circuits, and floating pins **before** you power up |
| 📐 **Professional EDA Export** | Generates industry-standard **KiCad Netlists** (`.net`) — go straight to professional PCB routing |
| 🧠 **Semantic Validation** | Graph-based netlist resolver ensures electrical connectivity is logically sound |

---

### 💻 DSL Example

```rust
// Define components and nets
let vcc   = Net::power(5.0);
let motor = Component::DCMotor;
let d_fly = Component::Diode { model: "Schottky" };

// Formal protection pattern (Flyback protection)
connect!(d_fly.cathode => motor.m_pos);
connect!(d_fly.anode  => motor.m_neg);

// System integration
connect!(motor.m_pos => vcc);
```

---

### 🛠️ Workflow

```
✍️  1. Define      →   Write your circuit logic in CircuitRust DSL
✅  2. Verify      →   Compiler runs a Safety Audit to catch violations  
📤  3. Export      →   Download the verified KiCad Netlist
🏭  4. Manufacture →   Import into KiCad PCB Editor for production
```

---
<br>

## 🇻🇳 Tiếng Việt

### 🎯 Tổng quan

**CircuitRust** là ngôn ngữ thiết kế phần cứng (DSL) lấy cảm hứng từ triết lý an toàn của Rust. Dự án chuyển đổi quy trình thiết kế mạch từ việc "kéo thả" dễ sai sót sang quy trình **Ưu tiên Mã nguồn (Code-First)**, nơi các quy tắc điện tử được kiểm tra nghiêm ngặt ngay khi biên dịch.

---

### 🚀 Tính năng nổi bật

| Tính năng | Mô tả |
|---|---|
| 🛡️ **Kiểm định an toàn** | Tự động phát hiện thiếu Flyback diode, đoản mạch, và chân lơ lửng |
| 📐 **Xuất bản chuyên nghiệp** | Xuất file **KiCad Netlist** (`.net`) — tạo PCB chuyên nghiệp ngay trong KiCad |
| 🧠 **Logic mạng lưới** | Thuật toán đồ thị xác thực toàn bộ kết nối điện học |

---

### 💻 Ví dụ mã nguồn

```rust
let vcc   = Net::power(5.0);
let motor = Component::DCMotor;
let d_fly = Component::Diode;

// Thiết lập cặp bảo vệ tải cảm (Flyback Diode)
connect!(d_fly.cathode => motor.m_pos);
connect!(d_fly.anode  => motor.m_neg);

// Kết nối vào hệ thống
connect!(motor.m_pos => vcc);
```

---

### 🛠️ Quy trình

```
✍️  1. Viết mã    →   Mô tả mạch điện bằng DSL CircuitRust
✅  2. Kiểm định  →   Trình biên dịch chạy Safety Audit phát hiện lỗi
📤  3. Xuất file  →   Tải file KiCad Netlist đã được xác thực
🏭  4. Sản xuất   →   Nhập vào KiCad PCB Editor để layout và đặt hàng
```

---
<br>

## 🇨🇳 中文

### 🎯 项目简介

**CircuitRust** 是一款受 Rust 安全哲学启发的硬件描述语言（DSL）。它将电路设计从易出错的"拖拽式"界面转变为**代码优先（Code-First）**的工作流，在编译阶段即强制执行电气规则。

---

### 🚀 核心特性

| 特性 | 说明 |
|---|---|
| 🛡️ **安全审计** | 自动检测缺少续流二极管、短路或引脚悬空，避免硬件损毁 |
| 📐 **专业 EDA 导出** | 生成工业标准 **KiCad 网表**（`.net`）— 直接进入专业 PCB 布线 |
| 🧠 **网表解析** | 基于图论的网表解析器，确保电路连接在逻辑上完全正确 |

---

### 💻 代码示例

```rust
// 定义元件与网络
let vcc   = Net::power(5.0);
let motor = Component::DCMotor;
let d_fly = Component::Diode { model: "Schottky" };

// 感性负载保护模式（续流二极管）
connect!(d_fly.cathode => motor.m_pos);
connect!(d_fly.anode  => motor.m_neg);

// 接入系统
connect!(motor.m_pos => vcc);
```

---

### 🛠 工作流程

```
✍️  1. 编写代码  →   使用 CircuitRust DSL 描述电路逻辑
✅  2. 验证      →   编译器运行安全审计，发现电气违规
📤  3. 导出      →   下载经过验证的 KiCad 网表
🏭  4. 制造      →   导入 KiCad PCB 编辑器进行专业布线与生产
```

---
<br>

<div align="center">

📄 Licensed under the **MIT License**

*Created with ❤️ by NTDD-code*

</div>
