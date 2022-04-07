# @upace/swagger-to-ts

通过 swagger 文档生成 TypeScript 代码

## 使用

```bash
npm install @upace/swagger-to-ts --global

swagger-to-ts -s http://yourhost/api-docs -o output
```

## 实现 httpClient

生存的代码使用自定义 httpClient，你只需要在调用接口前拦截处理，以下是示例

```ts
import httpClient from "./output/httpClient";

httpClient.handleRequest(async ({ method, url, body }) => {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
});
```

## 参数

```
Options:
  -s, --swagger [swagger]              输入url
  -o, --output [output]            输入目录
  -h, --http-client-output [path]  httpClient输出路径，默认存于输出目录
  --help                           display help for command
```

## 使用 swagger.config.js

```bash
swagger-to-ts --config swagger.config.js
```

swagger.config.js 示例

```js
module.exports = {
  httpClientOutput: "output",
  swaggers: [
    {
      swagger: "swagger1.json",
      output: "output/swagger1",
      // type Filter = string | RegExp | FunctionFilter;
      excludePath: /internal/,
      includePath: /api/,
      excludeTags: "tag1,tag2",
      includeTags: () => true,
    },
    {
      swagger: "swagger2.json",
      output: "output/swagger2",
      // type Filter = string | RegExp | FunctionFilter;
      excludePath: (pathName, operation) => pathName.includes('internal'),
      includePath: /api/,
      excludeTags: "tag1,tag2",
    },
  ],
};
```
