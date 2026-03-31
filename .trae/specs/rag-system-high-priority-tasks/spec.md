# RAG 系统高中优先级任务 - 产品需求文档

## Overview
- **Summary**: 系统地规划并实施 RAG 系统的高中优先级任务，包括外部知识源稳定性补强、RAG 质量证明和运行观测/审计补强。
- **Purpose**: 确保 RAG 系统的核心功能稳定可靠，提升系统质量和可观测性，为后续功能扩展奠定基础。
- **Target Users**: 开发团队、系统维护人员和最终用户。

## Goals
- 完成 P3: external knowledge source follow-up 任务，确保外部知识源的稳定性和可靠性。
- 完成 P5: RAG 质量证明任务，建立小而硬的 eval baseline，证明系统的质量和可靠性。
- 完成 P6: 运行观测 / 审计补强任务，提升系统的可观测性和审计能力。

## Non-Goals (Out of Scope)
- 不扩展新的 external source family。
- 不进行大规模架构重写。
- 不开展企业能力或多租户隔离等后续阶段的工作。
- 不进行 PC Web 后续局部收口等低优先级任务。

## Background & Context
- 项目已完成 P0: read-model / metadata convergence、P1: 鉴权 / 用户登录、P2: owner-only ACL baseline 三个核心阶段。
- 当前项目处于 P3: external knowledge source follow-up 阶段，采用"单线推进、小步增量、每轮收口"的工作模式。
- 系统已具备基本的外部知识源支持，包括 web page、feed、sitemap 和 sitemapindex。

## Functional Requirements
- **FR-1**: 完成 external knowledge source follow-up 任务，包括缺口盘点、诊断一致性、重试/超时处理、正文质量诊断和错误代码一致性。
- **FR-2**: 完成 RAG 质量证明任务，包括人工判断项（题集选择、标注、文档集版本选择、demo case 取舍）。
- **FR-3**: 完成运行观测 / 审计补强任务，包括 Usage、Report center、Trace Detail 的可读性和功能提升。

## Non-Functional Requirements
- **NFR-1**: 代码质量符合 TypeScript 严格编码规则，无 TypeScript 错误。
- **NFR-2**: 遵循项目的架构设计规范和质量控制流程。
- **NFR-3**: 每个任务的实现符合项目整体技术框架。
- **NFR-4**: 完成全面测试，包括单元测试、集成测试和功能验证。

## Constraints
- **Technical**: 基于现有的 NestJS API、React web app 和 shared package 架构。
- **Business**: 按照项目文档中定义的优先级和时间节点执行。
- **Dependencies**: 依赖现有的外部知识源实现、eval runner 和观测性工具。

## Assumptions
- 项目的基本架构和核心功能已经稳定。
- 开发环境已正确配置，包括 PostgreSQL、Redis 等依赖服务。
- 团队熟悉项目的代码结构和开发流程。

## Acceptance Criteria

### AC-1: P3 任务完成
- **Given**: 系统已具备基本的外部知识源支持。
- **When**: 完成 P3 任务的所有子任务。
- **Then**: 外部知识源的稳定性和可靠性得到提升，包括诊断一致性、重试/超时处理、正文质量诊断和错误代码一致性。
- **Verification**: `programmatic`
- **Notes**: 所有 P3 任务的测试用例都应通过。

### AC-2: P5 任务完成
- **Given**: P3 任务已完成。
- **When**: 完成 P5 任务的所有子任务。
- **Then**: 建立了小而硬的 eval baseline，证明了系统的质量和可靠性。
- **Verification**: `human-judgment`
- **Notes**: 需要人工完成题集选择、标注、文档集版本选择和 demo case 取舍。

### AC-3: P6 任务完成
- **Given**: P5 任务已完成。
- **When**: 完成 P6 任务的所有子任务。
- **Then**: 系统的可观测性和审计能力得到提升，包括 Usage、Report center、Trace Detail 的可读性和功能。
- **Verification**: `programmatic`
- **Notes**: 所有 P6 任务的测试用例都应通过。

## Open Questions
- [ ] P5 任务的人工判断项具体由谁负责完成？
- [ ] P3 任务的具体实现细节是否需要进一步细化？
- [ ] P6 任务的观测性提升具体包括哪些方面？