import { ZERO } from '../../../dataset/constant/Common'
import { VIRTUAL_ELEMENT_TYPE } from '../../../dataset/constant/Element'
import { ElementType } from '../../../dataset/enum/Element'
import { IElement } from '../../../interface/Element'
import { IPasteOption, IPasteEventData } from '../../../interface/Event'
import {
  getClipboardData,
  removeClipboardData,
  getPasteDataByNativeClipboardData
} from '../../../utils/clipboard'
import {
  formatElementContext,
  getElementListByHTML
} from '../../../utils/element'
import { CanvasEvent } from '../CanvasEvent'
import { IOverrideResult } from '../../override/Override'

import { isPromise } from '../../../utils'

export function pasteElement(host: CanvasEvent, elementList: IElement[]) {
  const draw = host.getDraw()
  if (draw.isReadonly() || draw.isDisabled()) return
  const rangeManager = draw.getRange()
  const { startIndex } = rangeManager.getRange()
  const originalElementList = draw.getElementList()
  // 全选粘贴无需格式化上下文
  if (~startIndex && !rangeManager.getIsSelectAll()) {
    // 如果是复制到虚拟元素里，则粘贴列表的虚拟元素需扁平化处理，避免产生新的虚拟元素
    const anchorElement = originalElementList[startIndex]
    if (anchorElement?.titleId || anchorElement?.listId) {
      let start = 0
      while (start < elementList.length) {
        const pasteElement = elementList[start]
        if (anchorElement.titleId && /^\n/.test(pasteElement.value)) {
          break
        }
        if (VIRTUAL_ELEMENT_TYPE.includes(pasteElement.type!)) {
          elementList.splice(start, 1)
          if (pasteElement.valueList) {
            for (let v = 0; v < pasteElement.valueList.length; v++) {
              const element = pasteElement.valueList[v]
              if (element.value === ZERO || element.value === '\n') {
                continue
              }
              elementList.splice(start, 0, element)
              start++
            }
          }
          start--
        }
        start++
      }
    }
    formatElementContext(originalElementList, elementList, startIndex, {
      isBreakWhenWrap: true
    })
  }
  draw.insertElementList(elementList)
}

export function pasteHTML(host: CanvasEvent, htmlText: string) {
  const draw = host.getDraw()
  if (draw.isReadonly() || draw.isDisabled()) return
  const elementList = getElementListByHTML(htmlText, {
    innerWidth: draw.getOriginalInnerWidth()
  })
  pasteElement(host, elementList)
}

export function pasteImage(host: CanvasEvent, file: File | Blob) {
  const draw = host.getDraw()
  if (draw.isReadonly() || draw.isDisabled()) return
  const rangeManager = draw.getRange()
  const { startIndex } = rangeManager.getRange()
  const elementList = draw.getElementList()
  // 创建文件读取器
  const fileReader = new FileReader()
  fileReader.readAsDataURL(file)
  fileReader.onload = () => {
    // 计算宽高
    const image = new Image()
    const value = fileReader.result as string
    image.src = value
    image.onload = () => {
      const imageElement: IElement = {
        value,
        type: ElementType.IMAGE,
        width: image.width,
        height: image.height
      }
      if (~startIndex) {
        formatElementContext(elementList, [imageElement], startIndex)
      }
      draw.insertElementList([imageElement])
    }
  }
}

function pasteByEventDefault(host: CanvasEvent, pasteData: IPasteEventData) {
  const { text, html, files } = pasteData

  // 优先读取编辑器内部粘贴板数据（粘贴板不包含文件时）
  if (!files.length) {
    const clipboardText = text
    const editorClipboardData = getClipboardData()
    if (clipboardText === editorClipboardData?.text) {
      pasteElement(host, editorClipboardData.elementList)
      return
    }
  }

  removeClipboardData()

  if (files.length) {
    // 全是文件才走这里
    files.forEach(file => {
      if (file.type.includes('image')) {
        pasteImage(host, file)
      }
    })
  } else if (html) {
    // 如果是 从 rtf 中解析出的文件，应该走这里，并将 html 中的 img 的 src 替换掉
    pasteHTML(host, html)
  } else if (text) {
    host.input(text)
  }
}

export function pasteByEvent(host: CanvasEvent, evt: ClipboardEvent) {
  const draw = host.getDraw()
  if (draw.isReadonly() || draw.isDisabled()) return
  const clipboardData = evt.clipboardData
  if (!clipboardData) return

  const pasteData = getPasteDataByNativeClipboardData(clipboardData)
  
  // 自定义粘贴事件
  const { paste } = draw.getOverride()

  if (paste) {
    const overrideResult = paste(pasteData)

    if (isPromise(overrideResult)) {
      (<Promise<unknown>>overrideResult).then(
        () => {
          pasteByEventDefault(host, pasteData)
        },
        () => undefined
      )
      return
    } else if ((<IOverrideResult>overrideResult).preventDefault !== false) {
      return
    }
  }

  pasteByEventDefault(host, pasteData)
}

async function pasteByApiDefault(host: CanvasEvent, options?: IPasteOption) {
  // 优先读取编辑器内部粘贴板数据
  const clipboardText = await navigator.clipboard.readText()
  const editorClipboardData = getClipboardData()
  if (clipboardText === editorClipboardData?.text) {
    pasteElement(host, editorClipboardData.elementList)
    return
  }
  removeClipboardData()
  // 从内存粘贴板获取数据
  if (options?.isPlainText) {
    if (clipboardText) {
      host.input(clipboardText)
    }
  } else {
    const clipboardData = await navigator.clipboard.read()
    let isHTML = false
    for (const item of clipboardData) {
      if (item.types.includes('text/html')) {
        isHTML = true
        break
      }
    }
    for (const item of clipboardData) {
      if (item.types.includes('text/plain') && !isHTML) {
        const textBlob = await item.getType('text/plain')
        const text = await textBlob.text()
        if (text) {
          host.input(text)
        }
      } else if (item.types.includes('text/html') && isHTML) {
        const htmlTextBlob = await item.getType('text/html')
        const htmlText = await htmlTextBlob.text()
        if (htmlText) {
          pasteHTML(host, htmlText)
        }
      } else if (item.types.some(type => type.startsWith('image/'))) {
        const type = item.types.find(type => type.startsWith('image/'))!
        const imageBlob = await item.getType(type)
        pasteImage(host, imageBlob)
      }
    }
  }
}

/**
 * pasteByApi 基于 navigator.clipboard 获取剪切板数据，不推荐使用，原因如下
 *
 * 从 navigator.clipboard 中读取的剪切板数据并不如 paste 事件对象中的数据完整
 *
 *    - 从 office 粘贴时，navigator.clipboard 不包含 rtf 格式的数据
 *    - 从文件系统拷贝图片文件时，navigator.clipboard 读取不到文件
 */
export async function pasteByApi(host: CanvasEvent, options?: IPasteOption) {
  const draw = host.getDraw()
  const isReadonly = draw.isReadonly()
  if (isReadonly) return

  // 自定义粘贴事件
  const { paste } = draw.getOverride()

  if (paste) {
    const overrideResult = paste()

    if (isPromise(overrideResult)) {
      (<Promise<unknown>>overrideResult).then(
        () => {
          pasteByApiDefault(host, options)
        },
        () => undefined
      )
      return
    } else if ((<IOverrideResult>overrideResult).preventDefault !== false) {
      return
    }
  }

  pasteByApiDefault(host, options)
}
