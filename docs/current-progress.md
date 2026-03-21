# Current Progress

鏇存柊鏃堕棿锛?026-03-21

## 1. 鐘舵€佹€昏

### 褰撳墠缁撹

椤圭洰宸茬粡瀹屾垚鏈湴浼樺厛 RAG MVP 鐨勪富閾捐矾锛屽綋鍓嶅彲浠ョǔ瀹氳窇閫氾細

- 鏂囨。涓婁紶
- 寮傛 ingestion
- chunking
- embedding
- indexing
- retrieval
- ask
- conversation / message / trace 鎸佷箙鍖?
- Web 绔牳蹇冮〉闈㈣仈璋?

褰撳墠闃舵宸茬粡涓嶅啀鏄鏋舵垨绾璁＄锛岄€傚悎缁х画鎸夊皬姝ュ閲忔帹杩涖€?

### 褰撳墠闃舵鍒ゆ柇

- 褰撳墠涓荤嚎鐘舵€侊細`MVP 鍙繍琛?+ 绗竴鐗堝彲璇婃柇 + 绗竴鐗堝彲閰嶇疆`
- 褰撳墠鏈€閫傚悎缁х画鎺ㄨ繘鐨勬柟鍚戯細
  - 涓婚摼璺祴璇曡ˉ寮?
  - DOCX 鏀寔
  - Answering 缁撴瀯鍖栦笌 assistant 閰嶇疆澧炲己

---

## 2. 绗竴鐗堝凡瀹屾垚

鏈妭琛ㄧず鈥滃凡缁忚惤鍦板苟鍙敤鈥濓紝浣嗕笉浠ｈ〃璇ユ柟鍚戝凡缁?fully done銆?

### 2.1 宸ョ▼涓庡熀纭€璁炬柦

- [x] `pnpm` monorepo 宸茶惤鍦?
- [x] 浠撳簱缁撴瀯宸叉媶鍒嗕负锛?
  - `apps/api`
  - `apps/web`
  - `packages/shared`
  - `docs`
- [x] PostgreSQL 宸叉帴鍏?
- [x] Redis 宸叉帴鍏?
- [x] Docker 鏈湴寮€鍙戝熀纭€璁炬柦宸叉彁渚?
- [x] 鏈湴寮€鍙戞枃妗ｅ凡鎻愪緵锛?
  - [README.md](/D:/FeProjects/rag-system/README.md)
  - [docs/current-dev-setup.md](/D:/FeProjects/rag-system/docs/current-dev-setup.md)
  - [docs/local-dev-infra.md](/D:/FeProjects/rag-system/docs/local-dev-infra.md)

### 2.2 鍚庣楠ㄦ灦

- [x] NestJS API 宸插垵濮嬪寲
- [x] 鍏ㄥ眬寮傚父杩囨护宸叉帴鍏?
- [x] 鍋ュ悍妫€鏌ユ帴鍙ｅ彲鐢細`GET /health`
- [x] 鏍稿績妯″潡杈圭晫宸插缓绔嬶細
  - `knowledge-bases`
  - `documents`
  - `assistants`
  - `retrieval-profiles`
  - `conversations`
  - `messages`
  - `traces`
  - `ingestion`
  - `indexing`
  - `retrieval`
  - `answering`
  - `infra/database`
  - `infra/storage`
  - `infra/queue`
  - `infra/llm`
  - `infra/vector-store`

### 2.3 鏁版嵁搴撲笌榛樿鏁版嵁

- [x] Prisma schema 宸插缓绔?
- [x] migration 宸插缓绔?
- [x] seed 鑴氭湰宸插缓绔?
- [x] 榛樿鏁版嵁宸插浐瀹氾細
  - tenant: `default-tenant`
  - user: `default-user`
  - knowledge base: `default-kb`
  - retrieval profile: `default-retrieval-profile`
  - assistant: `default-assistant`

### 2.4 鏂囨。閾捐矾绗竴鐗?

- [x] 鏂囨。涓婁紶
- [x] 鍘熷鏂囦欢鏈湴瀛樺偍
- [x] 鏂囨。鍏冩暟鎹叆搴?
- [x] Redis 闃熷垪寮傛澶勭悊
- [x] Markdown 瑙ｆ瀽
- [x] TXT 瑙ｆ瀽
- [x] text-based PDF 瑙ｆ瀽
- [x] chunking 绗竴鐗?
  - 鏍囬鎰熺煡鍒囧垎
  - 瓒呴暱娈佃惤鍒囧垎
  - 鏇寸ǔ瀹氱殑 chunk 闀垮害鎺у埗
- [x] chunk 钀藉簱
- [x] indexing 鎺ュ叆
- [x] embedding 鐢熸垚
- [x] 鏈湴 file-backed vector store 鍐欏叆
- [x] 鏂囨。鐘舵€佹祦杞細
  - `pending`
  - `processing`
  - `ready`
  - `failed`
- [x] `reindex`

褰撳墠鐩稿叧 API锛?

- [x] `GET /knowledge-bases/:id/documents`
- [x] `POST /knowledge-bases/:id/documents`
- [x] `POST /knowledge-bases/:id/documents/upload`
- [x] `GET /documents/:id`
- [x] `GET /documents/:id/chunks`
- [x] `DELETE /documents/:id`
- [x] `POST /documents/:id/reindex`

### 2.5 Retrieval 绗竴鐗?

- [x] 榛樿浼樺厛鍚戦噺鍙洖
- [x] lexical fallback
- [x] chunk window 鎵╁睍绗竴鐗?
- [x] hybrid retrieval 绗竴鐗?
- [x] rerank 绗竴鐗?
- [x] query rewrite 绗竴鐗?
- [x] RetrievalProfile metadata filter 绗竴鐗?
  - `documentIds`
  - `sectionTitles`
  - `pageNumbers`
- [x] retrieval score breakdown 鎸佷箙鍖栫涓€鐗?
  - `score`
  - `vectorScore`
  - `lexicalScore`
  - `hybridScore`
  - `rerankScore`

### 2.6 Ask / Answering / Trace 绗竴鐗?

- [x] `assistant -> retrieval profile -> retrieval -> answering` 涓婚摼璺墦閫?
- [x] conversation 鎸佷箙鍖?
- [x] message 鎸佷箙鍖?
- [x] trace 鎸佷箙鍖?
- [x] citation-aware prompt 绗竴鐗?
- [x] citations 杩斿洖
- [x] retrievedChunks 杩斿洖
- [x] `AnswerTrace.rewrittenQuery` 鎸佷箙鍖?
- [x] ask 澶辫触璇婃柇澧炲己绗竴鐗?
  - `ASK_PIPELINE_FAILED`
  - `traceId`
  - `details`
- [x] 鍏ㄥ眬 HTTP exception filter 淇濈暀缁撴瀯鍖栭敊璇瓧娈?

褰撳墠鐩稿叧 API锛?

- [x] `GET /assistants`
- [x] `GET /assistants/:id`
- [x] `PATCH /assistants/:id`
- [x] `POST /assistants/:id/ask`
- [x] `GET /retrieval-profiles`
- [x] `GET /retrieval-profiles/:id`
- [x] `POST /retrieval-profiles`
- [x] `PATCH /retrieval-profiles/:id`
- [x] `GET /conversations`
- [x] `GET /conversations/:id`
- [x] `GET /conversations/:id/messages`
- [x] `GET /conversations/:id/traces`
- [x] `GET /traces/:id`

### 2.7 LLM / Embedding 绗竴鐗?

- [x] Ollama 鐢熸垚鎺ュ叆
- [x] OpenAI 鐢熸垚鎺ュ叆
- [x] 鏈湴 fallback answer
- [x] Ollama embedding 鎺ュ叆
- [x] OpenAI embedding 鎺ュ叆
- [x] deterministic fallback embedding

### 2.8 Web MVP 绗竴鐗?

- [x] `Chat` 椤甸潰鎺ョ湡瀹?API
- [x] `Documents` 椤甸潰鎺ョ湡瀹?API
- [x] `Knowledge Base` 椤甸潰鎺ョ湡瀹?API
- [x] `Assistant` 椤甸潰鎺ョ湡瀹?API
- [x] Web i18n 绗竴鐗堬細`zh` / `en`
- [x] App shell 璇█鍒囨崲鍣?
- [x] 鏂囨。璇︽儏椤?
- [x] trace 璇︽儏椤?
- [x] citation -> 鏂囨。 chunk 娣遍摼璺宠浆
- [x] 鏂囨。璇︽儏 trace 涓婁笅鏂囬珮浜?
- [x] Documents / Chat 鏇存竻鏅扮殑 loading / empty / error 鐘舵€佺涓€鐗?
- [x] Knowledge Base 椤甸潰杩愯惀姒傝澧炲己绗竴鐗?
- [x] Assistant 椤甸潰宸叉毚闇?retrieval 鍩虹閰嶇疆瀛楁锛?
  - `topK`
  - `chunkWindow`
  - `enableHybrid`
  - `enableRerank`
  - `scoreThreshold`

### 2.9 娴嬭瘯涓庨獙璇佺涓€鐗?

- [x] `pnpm typecheck`
- [x] `pnpm build`
- [x] `pnpm test:api`
- [x] 鏈€灏?API 娴嬭瘯搴曞骇宸插缓绔?
- [x] 褰撳墠宸茶鐩栵細
  - PDF parsing
  - DOCX parsing
  - chunking
  - retrieval chunk window
  - hybrid retrieval
  - rerank
  - ingestion orchestrator
  - ask success orchestrator
  - citation-aware answering
  - ask failure diagnostics
  - retrieval profile filters
  - upload -> ready -> ask -> trace HTTP integration
  - document chunks / conversation messages / conversation traces integration assertions
- [x] API integration tests 宸叉敮鎸?`QUEUE_PREFIX` 闅旂锛岄伩鍏?Redis worker 涓叉壈
- [x] API 娴嬭瘯鍛戒护宸蹭覆琛屾墽琛岋紝閬垮厤鍏变韩鏁版嵁搴撶姸鎬佺殑 HTTP 闆嗘垚娴嬭瘯骞跺彂浜掔浉骞叉壈
- [x] web page source ingestion E2E
- [x] feed source ingestion E2E

---

## 3. 澧炲己鐗堟湭瀹屾垚

鏈妭琛ㄧず鈥滅涓€鐗堝凡缁忔湁锛屼絾鍚庣画澧炲己鐗堣繕娌″仛瀹屸€濄€?

### 3.1 Retrieval 澧炲己鐗堟湭瀹屾垚

- [x] metadata filter 鏇村畬鏁寸殑绛栫暐鍖栬兘鍔?
  - 宸叉敮鎸佸悜鍚庡吋瀹圭殑绛栫暐鍖栬繃婊わ細
    - `documentIds.include` / `documentIds.exclude`
    - `sectionTitles.include` / `sectionTitles.exclude` / `sectionTitles.contains`
    - `pageNumbers.include` / `pageNumbers.exclude` / `pageNumbers.min` / `pageNumbers.max`
- [x] chunk window 鎵╁睍鍚庣殑鏇村己鎷兼帴 / 缁勭粐绛栫暐
  - `ask` 鍝嶅簲鐜板凡鏂板 `contextGroups`
  - 杩炵画涓斿悓鏂囨。鐨?window chunks 浼氭寜 `chunkIndex` 缁勭粐涓?context group
  - group 褰撳墠杩斿洖锛?
    - `startChunkIndex` / `endChunkIndex`
    - `chunkIds` / `primaryChunkIds`
    - `mergedContent`
    - `pageNumbers` / `sectionTitles`
- [x] 鏇寸郴缁熺殑 retrieval 绛栫暐閰嶇疆涓庢紨杩涜兘鍔?
  - `RetrievalProfile.strategyJson` 宸叉敮鎸佺涓€鐗堢郴缁熷寲妫€绱㈢瓥鐣ラ厤缃?
  - 褰撳墠鏀寔锛?
    - `queryRewrite.enabled`
    - `candidateSelection.mode`: `vector` / `hybrid` / `lexical`
    - `candidateSelection.candidateMultiplier`
    - `candidateSelection.minCandidates`
    - `hybrid.vectorWeight` / `hybrid.lexicalWeight`
    - `rerank.enabled`
  - 淇濇寔鍏煎鏃㈡湁 `enableHybrid` / `enableRerank` 骞抽摵瀛楁
  - `ask` 宸叉寜瑙ｆ瀽鍚庣殑 retrieval strategy 鍐冲畾鏄惁 query rewrite
  - retrieval 宸叉寜绛栫暐鎺у埗鍊欓€夋睜瑙勬ā銆乴exical/vector/hybrid 妯″紡涓?hybrid merge 鏉冮噸

### 3.2 Answering 澧炲己鐗堟湭瀹屾垚

- [x] 鏇寸郴缁熺殑 prompt 绠＄悊
  - 宸叉柊澧?backend `PromptManagerService`
  - answer / rewrite prompt 宸蹭粠 `LlmService` 鍐呰仈瀛楃涓蹭腑鎶界
  - 褰撳墠宸叉敮鎸佺増鏈寲 prompt 鏍囪瘑锛?
    - `answer.v2`
    - `rewrite-query.v1`
  - Ollama / OpenAI 鐨?answer 涓?rewrite 璺緞宸茬粺涓€缁忕敱 prompt manager 鏋勯€?prompt
- [x] 杈撳嚭缁撴瀯绾︽潫
  - LLM structured answer JSON 宸叉柊澧炴樉寮?schema 鏍￠獙涓庢爣鍑嗗寲
  - 褰撳墠浼氱害鏉熷苟鏍囧噯鍖栵細
    - `answer`
    - `status`
    - `citations`
    - `missingInformation`
  - `citations` 宸叉敮鎸?numeric string -> integer 褰掍竴鍖栦笌鍘婚噸
  - 闈炴硶 structured payload 浠嶄細瀹夊叏鍥為€€鍒?plain-text 瑙ｆ瀽璺緞
- [x] 寮曠敤鐗囨涓庣瓟妗堢殑涓ユ牸缁撴瀯鍖栧榻?
- [x] 鍥炵瓟璐ㄩ噺璇勪及
- [x] 鏇村畬鏁寸殑 assistant / answer policy 閰嶇疆鑳藉姏

### 3.3 Web 澧炲己鐗堟湭瀹屾垚

- [x] 鏇村畬鏁寸殑 assistant / config 绠＄悊
  - RetrievalProfile `filtersJson` 鍓嶇缂栬緫鑳藉姏
  - 鏇村畬鏁寸殑 answering / assistant policy 閰嶇疆
- [x] 鏇村鑱旇皟绾ц嚜鍔ㄥ寲楠岃瘉
- 褰撳墠瀹㈡埛绔寖鍥达細`PC Web` 浼樺厛锛岀Щ鍔ㄧ閫傞厤鍚庣疆鍒板姛鑳藉拰楠岃瘉瑕嗙洊鏇寸ǔ瀹氫箣鍚庡啀鎺ㄨ繘

### 3.4 娴嬭瘯澧炲己鐗堟湭瀹屾垚

- [x] orchestrator / 妯″潡闆嗘垚娴嬭瘯
- [x] 鏇村畬鏁寸殑鏂囨。閾捐矫 E2E
- [x] 鏇村畬鏁寸殑 ask 閾捐矏 E2E
- [x] 鍓嶅悗绔仈璋冪骇鑷姩鍖栭獙璇?

### 3.5 Next Controlled Increment

- [x] retrieval / answering systematic evolution
- [ ] external knowledge source expansion
  - web page source ingestion minimum increment: done
  - feed source ingestion minimum increment: done
  - the broader external knowledge source direction is not complete yet; continue backend-first expansion from the current two source types
- keep backend / API first
- keep `PC Web` as the current client priority
- do not expand mobile work yet

---

## 4. 浠嶆湭鏀寔

鏈妭琛ㄧず鈥滃綋鍓嶄粨搴撹繕娌℃湁鐪熸鏀寔鈥濄€?

- [x] DOCX 鏀寔
- [x] 缃戦〉鍐呭鎶撳彇 / 缃戦〉鐭ヨ瘑婧愭帴鍏?
- [x] 澶栭儴鐭ヨ瘑婧愭帴鍏?

璇存槑锛?

- 杩欓噷鐨?`[x]` 琛ㄧず鈥滃閮ㄧ煡璇嗘簮鎺ュ叆鐨勭涓€杞渶灏忓彲鐢ㄨ兘鍔涘凡缁忚惤鍦扳€濓紝涓嶄唬琛ㄨ鏂瑰悜宸茬粡鏁翠綋瀹屾垚
- 褰撳墠宸插畬鎴愮殑鏈€灏忓閲忎富瑕佹槸锛?
  - one direct `http` / `https` web page source
  - one direct RSS / Atom feed source
- 鍚庣画鐨?`external knowledge source expansion` 浠嶇劧鏄綋鍓嶇殑涓嬩竴涓畬鏁翠换鍔℃柟鍚?

---

## 5. 鏆傛湭寮€濮嬩笖涓嶅睘浜庡綋鍓嶄富浼樺厛绾?

- [ ] 閴存潈
- [ ] 鐢ㄦ埛鐧诲綍
- [ ] 澶氱鎴烽殧绂?
- [ ] ACL / 鏂囨。鏉冮檺
- [ ] 浼佷笟绾у璁′笌娌荤悊鑳藉姏

---

## 6. 宸茶繃鏈熸棫鐘舵€?

浠ヤ笅璇存硶宸茬粡琚悗缁疄鐜版帹缈伙紝浠呬繚鐣欎綔鍘嗗彶绾犳锛?

- ~~hybrid retrieval 灏氭湭瀹炵幇~~
- ~~rerank 灏氭湭瀹炵幇~~
- ~~query rewrite 灏氭湭瀹炵幇~~
- ~~RetrievalProfile metadata filter 灏氭湭瀹炵幇~~
- ~~鏂囨。璇︽儏椤靛皻鏈畬鎴悀~
- ~~trace 璇︽儏椤靛皻鏈畬鎴悀~
- ~~Knowledge Base 椤甸潰鍙槸鏈€灏忓崰浣嶆憳瑕亊~
- ~~ask 澶辫触鏃跺彧鏈夊師濮嬪紓甯镐俊鎭瘇~

濡傛灉鏃ф枃妗ｄ腑浠嶅嚭鐜拌繖浜涜〃杩帮紝搴斾互鏈枃浠跺綋鍓嶅唴瀹逛负鍑嗐€?

---

## 7. 褰撳墠宸茬煡闄愬埗

- 褰撳墠鍚戦噺瀛樺偍浠嶆槸鏈湴杞婚噺 file-backed 瀹炵幇
- ask 缁撴灉璐ㄩ噺浠嶈緝渚濊禆 chunk 鍒囧垎璐ㄩ噺
- embedding 妯″瀷閫夋嫨鍜岀淮搴︾鐞嗕粛鏈畬鍏ㄩ厤缃寲
- 鏈厤缃彲鐢?embedding 妯″瀷鏃朵細閫€鍥?fallback embedding锛岃涔夊彫鍥炰笂闄愭湁闄?
- 褰撳墠鏇撮€傚悎鏈湴寮€鍙戝拰鍗曠敤鎴烽獙璇?
- 褰撳墠 worker 涓?API 浠嶅湪鍚屼竴杩涚▼妯″瀷涓嬭繍琛岋紝鍚庣画鍙啀鎷嗗垎
- Web 鏋勫缓鐩墠鏈?bundle size warning锛屼絾涓嶉樆濉炲紑鍙?

---

## 8. 褰撳墠浼樺厛绾?

### 8.1 宸插畬鎴愪紭鍏堢骇椤?

- [x] 鎺ュ叆鐪熷疄 embedding
- [x] 钀藉湴绗竴鐗?vector store
- [x] 鎵撻€?indexing -> retrieval 鐨勭湡瀹炲悜閲忛摼璺?
- [x] RetrievalProfile metadata filter 绗竴鐗?

### 8.2 褰撳墠鎺ㄨ崘涓嬩竴姝?

- [x] 涓婚摼璺祴璇曡ˉ寮?
- [x] DOCX 鏀寔
- [x] Answering 缁撴瀯鍖栦笌 assistant 閰嶇疆澧炲己

### 8.3 鍚庣画鍐嶅線鍚?

- [x] 鍓嶅悗绔仈璋冪骇鑷姩鍖栭獙璇?
- [x] 鏇村畬鏁寸殑鏂囨。閾捐矫 E2E
- [x] 鏇村畬鏁寸殑 ask 閾捐矏 E2E
- [x] retrieval / answering 鏇寸郴缁熷寲婕旇繘
- [ ] 澶栭儴鐭ヨ瘑婧愭墿灞?
- [ ] 鏇寸粏鐨勭Щ鍔ㄧ閫傞厤
- [ ] auth / 澶氱鎴?/ ACL
- [ ] 浼佷笟鑳藉姏

---

## 9. 鏈€杩戝畬鎴愮殑鍏抽敭澧為噺

### 2026-03-21

- [x] 涓婚摼璺祴璇曡ˉ寮?
- [x] DOCX 鏀寔
- [x] Answering 缁撴瀯鍖栦笌 assistant 閰嶇疆澧炲己
- [x] metadata filter 鏇村畬鏁寸殑绛栫暐鍖栬兘鍔?
- [x] chunk window 鎵╁睍鍚庣殑鏇村己鎷兼帴 / 缁勭粐绛栫暐
- [x] retrieval 绛栫暐閰嶇疆涓庢紨杩涜兘鍔?
- [x] 鏇寸郴缁熺殑 prompt 绠＄悊
- [x] 杈撳嚭缁撴瀯绾︽潫
- [x] trace/detail/document 璺宠浆涓庤瘖鏂寮?
- [x] web i18n锛坄zh` / `en`锛?
- [x] Knowledge Base 椤甸潰杩愯惀姒傝澧炲己
- [x] ask 澶辫触璇婃柇澧炲己
- [x] RetrievalProfile metadata filter
- [x] 寮曠敤鐗囨涓庣瓟妗堢殑涓ユ牸缁撴瀯鍖栧榻?
- [x] 鍥炵瓟璐ㄩ噺璇勪及
- [x] 鏇村畬鏁寸殑 assistant / answer policy 閰嶇疆鑳藉姏
- [x] 鏇村畬鏁寸殑 assistant / config 绠＄悊
- [x] API integration test queue isolation
- [x] PC Web Knowledge Base -> Assistant browser smoke automation
- [x] Document chain API E2E
- [x] Ask chain API E2E
- [x] Web page source ingestion API E2E
- [x] External feed source ingestion API E2E
- [x] retrieval / answering execution metadata

鍏抽敭鏂囦欢锛?

- [apps/api/src/modules/assistants/ask-assistant.error.ts](/D:/FeProjects/rag-system/apps/api/src/modules/assistants/ask-assistant.error.ts)
- [apps/api/src/modules/assistants/ask-assistant.service.ts](/D:/FeProjects/rag-system/apps/api/src/modules/assistants/ask-assistant.service.ts)
- [apps/api/src/modules/assistants/assistant.schemas.ts](/D:/FeProjects/rag-system/apps/api/src/modules/assistants/assistant.schemas.ts)
- [apps/api/src/modules/answering/answering.service.ts](/D:/FeProjects/rag-system/apps/api/src/modules/answering/answering.service.ts)
- [apps/api/src/infra/llm/llm.types.ts](/D:/FeProjects/rag-system/apps/api/src/infra/llm/llm.types.ts)
- [apps/api/src/infra/llm/prompt-manager.service.ts](/D:/FeProjects/rag-system/apps/api/src/infra/llm/prompt-manager.service.ts)
- [apps/api/src/common/http-exception.filter.ts](/D:/FeProjects/rag-system/apps/api/src/common/http-exception.filter.ts)
- [apps/api/src/modules/retrieval/retrieval.service.ts](/D:/FeProjects/rag-system/apps/api/src/modules/retrieval/retrieval.service.ts)
- [apps/api/src/modules/traces/traces.service.ts](/D:/FeProjects/rag-system/apps/api/src/modules/traces/traces.service.ts)
- [apps/api/prisma/schema.prisma](/D:/FeProjects/rag-system/apps/api/prisma/schema.prisma)
- [apps/api/prisma/migrations/20260321193000_add_answer_trace_execution_metadata/migration.sql](/D:/FeProjects/rag-system/apps/api/prisma/migrations/20260321193000_add_answer_trace_execution_metadata/migration.sql)
- [apps/api/src/modules/retrieval-profiles/retrieval-profile.schemas.ts](/D:/FeProjects/rag-system/apps/api/src/modules/retrieval-profiles/retrieval-profile.schemas.ts)
- [apps/api/src/modules/retrieval-profiles/retrieval-profiles.service.ts](/D:/FeProjects/rag-system/apps/api/src/modules/retrieval-profiles/retrieval-profiles.service.ts)
- [apps/api/src/infra/vector-store/vector-store.service.ts](/D:/FeProjects/rag-system/apps/api/src/infra/vector-store/vector-store.service.ts)
- [apps/web/src/pages/assistant/AssistantPage.tsx](/D:/FeProjects/rag-system/apps/web/src/pages/assistant/AssistantPage.tsx)
- [apps/web/src/pages/knowledge-base/KnowledgeBasePage.tsx](/D:/FeProjects/rag-system/apps/web/src/pages/knowledge-base/KnowledgeBasePage.tsx)
- [apps/web/src/pages/assistant/assistant-config-form.ts](/D:/FeProjects/rag-system/apps/web/src/pages/assistant/assistant-config-form.ts)
- [apps/web/src/features/api/hooks.ts](/D:/FeProjects/rag-system/apps/web/src/features/api/hooks.ts)
- [apps/web/src/types/api.ts](/D:/FeProjects/rag-system/apps/web/src/types/api.ts)
- [apps/web/src/i18n/messages.ts](/D:/FeProjects/rag-system/apps/web/src/i18n/messages.ts)
- [apps/web/test/assistant-config.test.js](/D:/FeProjects/rag-system/apps/web/test/assistant-config.test.js)
- [apps/web/test/pc-web-smoke.test.js](/D:/FeProjects/rag-system/apps/web/test/pc-web-smoke.test.js)
- [apps/api/test/document-chain-e2e.test.js](/D:/FeProjects/rag-system/apps/api/test/document-chain-e2e.test.js)
- [apps/api/test/ask-chain-e2e.test.js](/D:/FeProjects/rag-system/apps/api/test/ask-chain-e2e.test.js)
- [apps/api/test/web-page-source-e2e.test.js](/D:/FeProjects/rag-system/apps/api/test/web-page-source-e2e.test.js)
- [apps/api/test/feed-source-e2e.test.js](/D:/FeProjects/rag-system/apps/api/test/feed-source-e2e.test.js)
- [apps/api/src/infra/feed-source/feed-source.service.ts](/D:/FeProjects/rag-system/apps/api/src/infra/feed-source/feed-source.service.ts)
- [apps/api/src/infra/web-page/web-page.service.ts](/D:/FeProjects/rag-system/apps/api/src/infra/web-page/web-page.service.ts)
- [apps/api/src/modules/documents/documents.service.ts](/D:/FeProjects/rag-system/apps/api/src/modules/documents/documents.service.ts)
- [apps/api/src/modules/documents/documents.controller.ts](/D:/FeProjects/rag-system/apps/api/src/modules/documents/documents.controller.ts)
- [docs/superpowers/specs/2026-03-21-external-feed-source-ingestion-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-external-feed-source-ingestion-design.md)
- [docs/superpowers/plans/2026-03-21-external-feed-source-ingestion-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-external-feed-source-ingestion-plan.md)
- [docs/superpowers/specs/2026-03-21-web-page-source-ingestion-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-web-page-source-ingestion-design.md)
- [docs/superpowers/plans/2026-03-21-web-page-source-ingestion-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-web-page-source-ingestion-plan.md)
- [docs/superpowers/specs/2026-03-21-pc-web-integration-smoke-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-pc-web-integration-smoke-design.md)
- [docs/superpowers/specs/2026-03-21-document-chain-e2e-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-document-chain-e2e-design.md)
- [docs/superpowers/specs/2026-03-21-ask-chain-e2e-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-ask-chain-e2e-design.md)
- [docs/superpowers/plans/2026-03-21-document-chain-e2e-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-document-chain-e2e-plan.md)
- [docs/superpowers/plans/2026-03-21-ask-chain-e2e-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-ask-chain-e2e-plan.md)
- [docs/superpowers/plans/2026-03-21-pc-web-integration-smoke-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-pc-web-integration-smoke-plan.md)
- [apps/api/test/ingestion.orchestrator.test.js](/D:/FeProjects/rag-system/apps/api/test/ingestion.orchestrator.test.js)
- [apps/api/test/ask-success.test.js](/D:/FeProjects/rag-system/apps/api/test/ask-success.test.js)
- [apps/api/test/assistants-api.test.js](/D:/FeProjects/rag-system/apps/api/test/assistants-api.test.js)
- [apps/api/test/ask-failures.test.js](/D:/FeProjects/rag-system/apps/api/test/ask-failures.test.js)
- [apps/api/test/api-flow.test.js](/D:/FeProjects/rag-system/apps/api/test/api-flow.test.js)
- [apps/api/test/http-exception-filter.test.js](/D:/FeProjects/rag-system/apps/api/test/http-exception-filter.test.js)
- [apps/api/test/retrieval-profile-filters.test.js](/D:/FeProjects/rag-system/apps/api/test/retrieval-profile-filters.test.js)
- [docs/superpowers/plans/2026-03-21-ask-failure-diagnostics-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-ask-failure-diagnostics-plan.md)
- [docs/superpowers/plans/2026-03-21-main-chain-test-hardening-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-main-chain-test-hardening-plan.md)
- [docs/superpowers/specs/2026-03-21-docx-support-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-docx-support-design.md)
- [docs/superpowers/plans/2026-03-21-docx-support-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-docx-support-plan.md)
- [docs/superpowers/specs/2026-03-21-retrieval-profile-metadata-filter-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-retrieval-profile-metadata-filter-design.md)
- [docs/superpowers/plans/2026-03-21-retrieval-profile-metadata-filter-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-retrieval-profile-metadata-filter-plan.md)
- [docs/superpowers/specs/2026-03-21-retrieval-strategy-configuration-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-retrieval-strategy-configuration-design.md)
- [docs/superpowers/plans/2026-03-21-retrieval-strategy-configuration-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-retrieval-strategy-configuration-plan.md)
- [docs/superpowers/specs/2026-03-21-prompt-management-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-prompt-management-design.md)
- [docs/superpowers/plans/2026-03-21-prompt-management-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-prompt-management-plan.md)
- [docs/superpowers/specs/2026-03-21-structured-output-constraints-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-structured-output-constraints-design.md)
- [docs/superpowers/plans/2026-03-21-structured-output-constraints-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-structured-output-constraints-plan.md)
- [docs/superpowers/specs/2026-03-21-answering-structured-assistant-config-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-answering-structured-assistant-config-design.md)
- [docs/superpowers/plans/2026-03-21-answering-structured-assistant-config-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-answering-structured-assistant-config-plan.md)
- [docs/superpowers/specs/2026-03-21-answer-citation-alignment-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-answer-citation-alignment-design.md)
- [docs/superpowers/plans/2026-03-21-answer-citation-alignment-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-answer-citation-alignment-plan.md)
- [docs/superpowers/specs/2026-03-21-answer-quality-evaluation-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-answer-quality-evaluation-design.md)
- [docs/superpowers/plans/2026-03-21-answer-quality-evaluation-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-answer-quality-evaluation-plan.md)
- [docs/superpowers/specs/2026-03-21-assistant-answer-policy-expansion-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-assistant-answer-policy-expansion-design.md)
- [docs/superpowers/plans/2026-03-21-assistant-answer-policy-expansion-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-assistant-answer-policy-expansion-plan.md)
- [docs/superpowers/specs/2026-03-21-assistant-config-management-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-assistant-config-management-design.md)
- [docs/superpowers/plans/2026-03-21-assistant-config-management-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-assistant-config-management-plan.md)
- [docs/superpowers/specs/2026-03-21-retrieval-answering-execution-metadata-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-retrieval-answering-execution-metadata-design.md)
- [docs/superpowers/plans/2026-03-21-retrieval-answering-execution-metadata-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-retrieval-answering-execution-metadata-plan.md)

---

## 10. 鏈€杩戜竴娆″凡璁板綍鐨勯獙璇佸揩鐓?

鏈€杩戜竴娆″凡璁板綍閫氳繃鐨勫懡浠わ細

### API

- `pnpm --filter @rag-system/api build`
- `node --test apps/api/test/retrieval.test.js apps/api/test/ask-success.test.js apps/api/test/answering.test.js`
- `node --test --test-concurrency=1 apps/api/test/api-flow.test.js`
- `node --test apps/api/test/retrieval.test.js apps/api/test/ask-success.test.js apps/api/test/assistants-api.test.js`
- `node --test --test-concurrency=1 apps/api/test/retrieval-profile-filters.test.js`
- `node --test --test-concurrency=1 apps/api/test/retrieval-profile-strategy.test.js`
- `node --test apps/api/test/prompt-manager.test.js apps/api/test/llm.test.js`
- `node --test apps/api/test/llm.test.js`
- `node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/assistants-api.test.js`
- `node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/assistants-api.test.js apps/api/test/prompt-manager.test.js`
- `node --test --test-concurrency=1 apps/api/test/api-flow.test.js`
- `node --test --test-concurrency=1 apps/api/test/ingestion.orchestrator.test.js apps/api/test/ask-success.test.js apps/api/test/ask-failures.test.js apps/api/test/api-flow.test.js`
- `node --test apps/api/test/ask-failures.test.js apps/api/test/http-exception-filter.test.js`
- `node --test apps/api/test/retrieval.test.js apps/api/test/retrieval-profile-filters.test.js`
- `pnpm test:api`
- `node --test --test-concurrency=1 apps/api/test/retrieval-profile-filters.test.js`
- `node --test --test-concurrency=1 apps/api/test/ask-chain-e2e.test.js`
- `node --test --test-concurrency=1 apps/api/test/web-page-source-e2e.test.js`
- `node --test --test-concurrency=1 apps/api/test/feed-source-e2e.test.js`

### Web

- `pnpm --filter @rag-system/web typecheck`
- `pnpm --filter @rag-system/web build`
- `node --test apps/web/test/*.test.js`
- `node --experimental-strip-types --test apps/web/test/assistant-config.test.js`
- `node --test apps/web/test/pc-web-smoke.test.js`

璇存槑锛?

- 杩欓噷璁板綍鐨勬槸鏈€杩戜竴娆″凡钀界洏楠岃瘉蹇収
- 涓嶄唬琛ㄦ瘡娆＄紪杈戞湰鏂囦欢鏃堕兘閲嶆柊鎵ц浜嗚繖浜涘懡浠?

---

## 11. 鍏抽敭鏂囨。鍏ュ彛

- [README.md](/D:/FeProjects/rag-system/README.md)
- [docs/current-dev-setup.md](/D:/FeProjects/rag-system/docs/current-dev-setup.md)
- [docs/local-dev-infra.md](/D:/FeProjects/rag-system/docs/local-dev-infra.md)
- [docs/phase-1-rag-blueprint.md](/D:/FeProjects/rag-system/docs/phase-1-rag-blueprint.md)
- [docs/retrieval-trace.md](/D:/FeProjects/rag-system/docs/retrieval-trace.md)
- [docs/web-i18n.md](/D:/FeProjects/rag-system/docs/web-i18n.md)

