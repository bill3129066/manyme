/// <reference types="bun-types" />
import React from 'react'
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import Markdown from './Markdown'

test('agent output renders headings, emphasis, lists and tables without raw HTML', () => {
  const html = renderToStaticMarkup(<Markdown>{'### 行程\n\n**親子**\n\n1. 出發\n\n| 日期 | 地點 |\n| --- | --- |\n| 一 | 日本 |\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))'}</Markdown>)
  expect(html).toContain('<h3>行程</h3>')
  expect(html).toContain('<strong>親子</strong>')
  expect(html).toContain('<ol>')
  expect(html).toContain('<table>')
  expect(html).not.toContain('<script>')
  expect(html).not.toContain('javascript:')
})
