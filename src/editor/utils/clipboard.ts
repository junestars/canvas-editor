import { IEditorOption, IElement } from '..'
import { EDITOR_CLIPBOARD } from '../dataset/constant/Editor'
import {
  IMG_LOCAL_SOURCE_REGEXP,
  IMG_SRC_REGEXP
} from '../dataset/constant/Common'
import { DeepRequired } from '../interface/Common'
import { IImageHexSource, IPasteEventData } from '../interface/Event'
import { createDomFromElementList, zipElementList } from './element'

export interface IClipboardData {
  text: string
  elementList: IElement[]
}

export function setClipboardData(data: IClipboardData) {
  localStorage.setItem(
    EDITOR_CLIPBOARD,
    JSON.stringify({
      text: data.text,
      elementList: data.elementList
    })
  )
}

export function getClipboardData(): IClipboardData | null {
  const clipboardText = localStorage.getItem(EDITOR_CLIPBOARD)
  return clipboardText ? JSON.parse(clipboardText) : null
}

export function removeClipboardData() {
  localStorage.removeItem(EDITOR_CLIPBOARD)
}

export function writeClipboardItem(
  text: string,
  html: string,
  elementList: IElement[]
) {
  if (!text && !html && !elementList.length) return
  const plainText = new Blob([text], { type: 'text/plain' })
  const htmlText = new Blob([html], { type: 'text/html' })
  if (window.ClipboardItem) {
    // @ts-ignore
    const item = new ClipboardItem({
      [plainText.type]: plainText,
      [htmlText.type]: htmlText
    })
    window.navigator.clipboard.write([item])
  } else {
    const fakeElement = document.createElement('div')
    fakeElement.setAttribute('contenteditable', 'true')
    fakeElement.innerHTML = html
    document.body.append(fakeElement)
    // add new range
    const selection = window.getSelection()
    const range = document.createRange()
    // 增加尾行换行字符避免dom复制缺失
    const br = document.createElement('span')
    br.innerText = '\n'
    fakeElement.append(br)
    // 扩选选区并执行复制
    range.selectNodeContents(fakeElement)
    selection?.removeAllRanges()
    selection?.addRange(range)
    document.execCommand('copy')
    fakeElement.remove()
  }
  // 编辑器结构化数据
  setClipboardData({ text, elementList })
}

export function writeElementList(
  elementList: IElement[],
  options: DeepRequired<IEditorOption>
) {
  const clipboardDom = createDomFromElementList(elementList, options)
  // 写入剪贴板
  document.body.append(clipboardDom)
  const text = clipboardDom.innerText
  // 先追加后移除，否则innerText无法解析换行符
  clipboardDom.remove()
  const html = clipboardDom.innerHTML
  if (!text && !html && !elementList.length) return
  writeClipboardItem(text, html, zipElementList(elementList))
}

export function getIsClipboardContainFile(clipboardData: DataTransfer) {
  let isFile = false
  for (let i = 0; i < clipboardData.items.length; i++) {
    const item = clipboardData.items[i]
    if (item.kind === 'file') {
      isFile = true
      break
    }
  }
  return isFile
}

export function _convertHexToBase64(hexString: string): string {
  return btoa(
    hexString
      .match(/\w{2}/g)!
      .map(char => {
        return String.fromCharCode(parseInt(char, 16))
      })
      .join('')
  )
}

/**
 * 从 RTF 格式的数据中提取文件
 * @param {string} rtfData - RTF 数据
 * @returns {IImageHexSource[]} 提取出的文件列表
 */
export function extractImageDataFromRtf(rtfData: string): IImageHexSource[] {
  if (!rtfData) {
    return []
  }

  const regexPictureHeader =
    /{\\pict[\s\S]+?({\\\*\\blipuid\s?[\da-fA-F]+)[\s}]*/
  const regexPicture = new RegExp(
    '(?:(' + regexPictureHeader.source + '))([\\da-fA-F\\s]+)\\}',
    'g'
  )
  const images = rtfData.match(regexPicture)
  const imagesHexSources = []

  if (images) {
    for (const image of images) {
      let imageType = ''
      if (image.includes('\\pngblip')) {
        imageType = 'image/png'
      } else if (image.includes('\\jpegblip')) {
        imageType = 'image/jpeg'
      }
      if (imageType) {
        imagesHexSources.push({
          hex: image
            .replace(regexPictureHeader, '')
            .replace(/[^\da-fA-F]/g, ''),
          type: imageType
        })
      }
    }
  }

  return imagesHexSources
}

/**
 * 将 html 字符串中的本地图片源替换成从 rtf 中解析出的 base64 源，如果图片数量不同，则返回原 html 字符串
 * @param {string} html - html 字符串
 * @param {string} imgTags - 要替换的 img 标签列表
 * @param {string} rtfData - rtf 数据
 * @returns 返回替换后的 html 字符串
 */
function replaceImagesFileSourceWithInlineRepresentation(
  html: string,
  imgTags: string[],
  rtfData: string
): string {
  const imagesHexSources = extractImageDataFromRtf(rtfData)
  const imgTagsLen = imgTags.length
  if (imgTagsLen === imagesHexSources.length) {
    for (let i = 0; i < imgTagsLen; i++) {
      const src = `data:${
        imagesHexSources[i].type
      };base64,${_convertHexToBase64(imagesHexSources[i].hex)}`

      html = html.replace(
        imgTags[i],
        imgTags[i].replace(IMG_SRC_REGEXP, `src="${src}"`)
      )
    }
  }
  return html
}

/**
 * 从原生 paste 事件中的 clipboardData 上提取粘贴的数据，包括 text/html/rtf/file 数据
 * @param {DataTransfer} clipboardData - paste 事件的 clipboardData 对象
 * @returns {IPasteEventData} 提取出的各种格式的数据组成的对象
 */
export function getPasteDataByNativeClipboardData(
  clipboardData: DataTransfer
): IPasteEventData {
  const pasteEventData: IPasteEventData = {
    text: '',
    html: '',
    rtf: '',
    files: []
  }

  if (clipboardData.types.includes('text/plain')) {
    pasteEventData.text = clipboardData.getData('text/plain')
  }

  if (clipboardData.types.includes('text/html')) {
    pasteEventData.html = clipboardData.getData('text/html')
  }

  if (clipboardData.types.includes('text/rtf')) {
    pasteEventData.rtf = clipboardData.getData('text/rtf')

    const imageTags = pasteEventData.html.match(IMG_LOCAL_SOURCE_REGEXP) || []
    if (imageTags.length) {
      pasteEventData.html = replaceImagesFileSourceWithInlineRepresentation(
        pasteEventData.html,
        imageTags,
        pasteEventData.rtf
      )
    }
  }

  if (clipboardData.types.includes('Files')) {
    pasteEventData.files = Array.from(clipboardData.files)
  }

  return pasteEventData
}
