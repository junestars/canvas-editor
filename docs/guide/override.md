# 重写方法

## 使用方式

```javascript
import Editor from "@hufe921/canvas-editor"

const instance = new Editor(container, <IElement[]>data, options)

instance.override.overrideFunction = () => unknown | IOverrideResult
```

```typescript
interface IOverrideResult {
  preventDefault?: boolean // 阻止执行内部默认方法。默认阻止
}
```

## paste

功能：重写粘贴方法

用法：

```typescript
interface IPasteEventData {
  text: string
  html: string
  rtf: string
  files: File[]
}
```

```javascript
// 仅 override.paste 支持返回 Promise
// Promise 被兑现，表示继续执行内部默认方法，否则表示阻止

// 可根据 paste 是否接收到参数判断 调用 paste 的类型
// 有参数表示 Event 调用，无参数表示 API 调用
instance.override.paste = (evt?: IPasteEventData) => unknown | IOverrideResult | Promise<unknown>
```

## copy

功能：重写复制方法

用法：

```javascript
instance.override.copy = () => unknown | IOverrideResult
```

## drop

功能：重写拖放方法

用法：

```javascript
instance.override.drop = (evt: DragEvent) => unknown | IOverrideResult
```
