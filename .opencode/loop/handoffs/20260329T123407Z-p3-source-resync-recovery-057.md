# p3-source-resync-recovery-057

- 标题: source resync recovery guards
- 状态: completed
- 代理: rag-build
- 会话: ses_2c66e8751ffeURK1ZlZ7AkkvsW
- 消息: msg_d39963929001pFJDoOFYZPIn9A
- 开始: 2026-03-29 20:28:48
- 恢复: 2026-03-29 20:28:48
- 收到: 2026-03-29 20:34:07
- 完成: 2026-03-29 20:34:07

## 结果
[
  {
    "type": "step-start",
    "snapshot": "292554819d4800826a623dadf191f518df426753",
    "id": "prt_d399643af001H1G6wD4FWQ3Xib",
    "sessionID": "ses_2c66e8751ffeURK1ZlZ7AkkvsW",
    "messageID": "msg_d39963929001pFJDoOFYZPIn9A"
  },
  {
    "type": "reasoning",
    "text": "",
    "metadata": {
      "openai": {
        "itemId": "rs_04d4bef84b55af1c0169c91c3bfd748191b92782c3fe926452",
        "reasoningEncryptedContent": "gAAAAABpyRw9hwv2CQ8bQRK-2dUM40zYZHwEI8ocu8Vi5G-KJndWrIYFOSrYSTmZSAa0wvgonRrlu_ctqB9kk5EOpxxsmRPymn6JrjjZQMU66Tpv4xip5vc0Lf684tu0LahqNc-v1T4rwvZ6wQhfZhjdQv4Ywoo4U6DSNgi3KXKkOkS0d8PLP60Y9OQA4IHIl4ZMXj4-k2cJfbBeFZpsLnvIp9fJst9xAcbLcZJMNCxEU3_Swry7iaVGBY70-2scxPmete00TbOr3tdaH-dwJVSSR0c51SORziF3qccLbHVmd7GJCVowiZCLgXAvahtYVPcLtpYzq5Q80tRE18cHbY9QnwlVTiwHJodl9SN0XULRQSxCVCI2Bx5AguDiofBeqM7wW_5Tw1qbYwJlH2dUb0SlKaBnMh9iIUnHjLglDeVxphw2QjVS23KmCU9l3C32H26P8aT0pc7TSPuZtUON_1FRlMWb-VL9wlCT6oplfggWdujvy7yVsn2Pdv-d0ryEsw_H7Dbvw7E0ulrJE3tLVHAQnNhMpWx0_NmoPCVgcRBgB0hRMeQKBtL9rXOvBceZ0TUHrzvOwsvHGLlp_iantRmXxrAYFClSIcCAcV6VroPAuPsz8G7Bu8wbxjbvjUwKWvtXlb1EHCqZUtOIrCDNn7vw4D6QgLdmodMtxAqNlGmAP6qrksxUBi5LYLt4N_V263dGtJhLk923QvfWoNzOCnaofEJBaFpBSTtCL9I4DKQ7UyAjCYqDLmql8hkPaOr5zQpWm1Fi7pr6rkCxo9OmZ-f9TIhR1zGNVUXqfwm3L0DUnnX0yFNFMz801EzB7YwIioVHsVsRDtYWKv-AhfbC9hovH4reSNaDmOyoU43bf3GgB92GRy3UV5VDv695dklmPcS-FQZVypibW7wiO6W_wyLUjiMRqHOBzURgaeg1773JCrrF0SSs4jB3Xnif4sNDvc4jxy0Vfwaqha2fte40AJZd4CjKMvQhSmq1q7iGxJQy7QIiwXqNqekyhzS_4veKETf2bjrzPZ-pChnH7o9dtv7zvFQbUCk7FKPo_Wc-DCiRdBCVNmcE6cCy5tPsm_UV25pL9tAlQm4iY9YADRe0SVZT5v5jOlLrfjlVU_DO0jSaaTIA7sWQNNZUuYNHDdTe0dTBQlskIOs3aFOldU3wEf-KFQvtZqo2mGPiyCKoaXXTNur1342_qXc="
      }
    },
    "time": {
      "start": 1774787642467,
      "end": 1774787643646
    },
    "id": "prt_d39964462001HWgbGcPBXbD2YY",
    "sessionID": "ses_2c66e8751ffeURK1ZlZ7AkkvsW",
    "messageID": "msg_d39963929001pFJDoOFYZPIn9A"
  },
  {
    "type": "text",
    "text": "",
    "time": {
      "start": 1774787643647
    },
    "metadata": {
      "openai": {
        "itemId": "msg_04d4bef84b55af1c0169c91c3d6d60819180ab1ee40017fede"
      }
    },
    "id": "prt_d399648ff001GmSqAU0qPwsToU",
    "sessionID": "ses_2c66e8751ffeURK1ZlZ7AkkvsW",
    "messageID": "msg_d39963929001pFJDoOFYZPIn9A"
  }
]

## 提示词
```text
Execution mode: implement the requested repository increment now.
Do not stop at search-only or analysis-only output.
First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands.
Commit each completed increment on the current branch, but keep push and PR decisions for a stable wave closeout point after validation is green.
Prefer `dev` for backend work unless the task explicitly requires a different branch transition.

Repository build policy:
基于已确认的最小计划执行实现。先检查相关代码路径和现有模式，再做最小具体改动。优先 backend-first、小步增量、快验证；运行一个最相关验证，并明确报告改动文件和验证命令；不做无关重构。TDD 不是默认流程，仅在行为语义、共享契约、source recovery 等改动时启用 light TDD。若需求不清晰或存在冲突，不要猜；直接 fail fast 并报告不确定点。

Task:
Inspect the current external-source resync/version/recovery paths, especially `feed` / `sitemap` missing-full-config recovery, same-URL reuse/version handling, and stale-job guards, plus `test/external-source-sync.test.js`, first. Then close the smallest remaining P3 recovery gaps so existing source re-sync behavior is more robust without expanding source-family scope. Keep scope narrow: resync/recovery guards only; do not add new source types, do not redesign the sync architecture, and do not change ask/retrieval behavior semantics. Run exactly one focused validation command: `pnpm test:api:file -- test/external-source-sync.test.js`. Report the exact changed files and the exact command result.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

