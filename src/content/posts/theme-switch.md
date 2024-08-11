---
title: 浅析站点通用的主题肤色切换思路与实践
date: 2024-01-15
tags: [CSS, JavaScript]
category: 技术
summary: 在当今的信息化时代，网站已经成为人们获取信息、交流互动的重要平台。而网站的视觉效果对于用户体验至关重要。颜色作为视觉效果的关键元素之一...
---

# 浅析常见站点通用的主题肤色切换思路与实践

![bg](https://raw.githubusercontent.com/CodeListener/resources/main/20240811163004.png)
在当今的信息化时代，网站已经成为人们获取信息、交流互动的重要平台。而网站的视觉效果对于用户体验至关重要。颜色作为视觉效果的关键元素之一，能够直接影响用户的情绪和认知。因此，对于一个网站来说，提供一种方便、可定制且效果显著的主题是至关重要的。本文将探讨常见的站点通用的主题色切换方案，并给出实际应用的示例。废话不多说了，我们开始吧

## 概述

> 本文基于 Vue3+typescript+vite,以三种方式的最小化 demo 示例来进行讲解，
> 完整的 DEMO 已放到 github 可以拉取下来运行[点击链接跳转仓库](https://github.com/CodeListener/switch-theme)

1.  多样式 + class 切换 （明亮/暗黑模式）
2.  css var + class 切换 （多肤色切换）
3.  css var + setProperty （动态设置肤色切换）

![all.gif](https://raw.githubusercontent.com/CodeListener/resources/main/111.gif)

其实现逻辑并不复杂，原理都是基于 class 类切换和 js 动态设置样式/css 变量, 以下是主要的核心代码

```javascript
// 切换class
// 1, 2 示例使用class切换更改样式
function setClass(isDark = false) {
  const target = document.documentElement
  if (isDark) {
    target.classList.add('dark')
    target.classList.remove('light')
  } else {
    target.classList.add('light')
    target.classList.remove('dark')
  }
}

// 3 示例使用js动态设置css变量，在对应元素加上css变量,即可动态设置
const setCssVar = (key, val) => {
  document.documentElement.style.setProperty(key, val)
}
```

核心代码看起来是不是很简单，下面介绍相关案例的实践

## 明亮/暗黑模式

明亮/暗黑模式其实就是在编写完目标样式之后多编写一套暗黑主题的 css 样式，当通过 class 切换，将指定目标设置成另外的颜色等样式。

### 即时切换

即时切换即对编写的样式在页面加载的时候一并返回，在点击切换时达到无延迟效果。以下示例时通过 vite 进行开发，在最后打包阶段会输出单独的样式文件包含着暗黑模式的样式

> 具体示例

[jcode](https://code.juejin.cn/pen/7288977580383748156)

### 延迟加载

> Tips: 关于【延迟加载切换】实际上在这个示例中并不是最好的体现，而且以个人角度觉得似乎并没有多少场景需要，但为了以最小的示例表述延迟加载，所以在这个示例一并讲解，**在文章的最后有一个自己写的在前端展示切换自定义文章主题的图例可以看看**

即时切换实际上就是将样式文件一次性加载，保证切换快速，不需要额外请求另一份样式之后在设置样式。但在针对编写的 css 文件非常大(一般应该也不会)**特定场景不同样式风格（可看文章最后）**，我们可以将每一份样式表在切换的时候进行单独请求加载，其主要步骤：

1.  编写一份默认样式及其多种风格样式文件：a.css, b.css, c.css;
2.  对默认加载样式的标签添加一个自定义属性\[data-theme]
3.  根据切换时请求加载指定主题样式表对 style\[data-theme]的指定标签内容进行替换

> **伪代码**如下

```javascript
// 加载远程样式表
function loadStyleSheet(themeName) {
  // 在加载指定样式主题后可以将其缓存，在后续就不需要重复请求
  return axios.get(`${themeName}.css`)
}
// 设置指定样式表内容并添加到head
function createStyleTag(content) {
  const attr = 'data-theme'
  const themeStyleTag = document.querySelector(`[${attr}]`)
  if (themeStyleTag) {
    themeStyleTag.remove()
  }
  const styleTag = document.createElement('style')
  styleTag.setAttribute(attr, name)
  styleTag.innerHTML = content
  document.head.appendChild(styleTag)
}
// 切换主题
function setTheme(themeName) {
  loadStyleSheet(themeName).then((res) => {
    const text = res.data
    createStyleTag(text)
  })
}
document.addEventListener('load', function () {
  // 页面起初加载默认明亮模式
  setTheme('light')
})
```

> 具体示例

[jcode](https://code.juejin.cn/pen/7289348835770368039)

以上我们通过模拟请求来实现加载异步样式表，**如果你使用 vite 开发，还可以结合 import.meta.glob 及其 import() 来进行实现**

## 多肤色切换

在示例 1 中我们通过使用 class+多样式编写切换，每次都要在不同的样式表中对目标设置指定颜色，假如好几种颜色的情况下，那就要编写更多的 css 了，写起来挺麻烦的，有没有可以让他们公用一套 css 呢？这里就要说到 css 变量啦，以下是使用 css 变量和没有使用的区分

- 没有使用 css 变量时

```css
body {
  background-color: #fff;
  color: #000;
}
/* red主题 */
html.red body {
  background-color: red;
  color: rgb(206, 206, 206);
}
/* blue主题 */
html.blue body {
  background-color: blue;
  color: rgb(206, 206, 206);
}
/* orange主题 */
html.orange body {
  background-color: orange;
  color: rgb(206, 206, 206);
}
```

- 使用 css 变量时：

```css
html {
  --text-color: #222;
  &.red {
    --bg-color: rgb(245, 45, 45);
    --text-color: #fff;
    /* more style... */
  }
  &.blue {
    --bg-color: rgb(76, 76, 230);
    --text-color: #fff;
    /* more style... */
  }
  &.orange {
    --bg-color: orange;
    --text-color: #fff;
    /* more style... */
  }
}
html body {
  background-color: var(--bg-color);
  color: var(--text-color);
}
```

可以看出加入样式以多且需要设置的颜色也多的情况下，重复性的样式编写就成倍增长，在引用变量之后，我们只需要维护 css 变量，在切换 class 对 css 变量设置成不同的颜色值即可

> 具体示例

[jcode](https://code.juejin.cn/pen/7289349955313991736)

## 动态设置肤色切换

动态设置肤色则是比多肤色切换的更高自由度，多肤色需要我们提前定义好每个主题下的颜色样式，而动态设置则是把选择权交给了用户，用户想什么颜色主题就什么颜色主题。摆脱了每种主题类变量编写的区分（相当于移除示例二的多类 css 变量编写），通过 js 来对 css 变量进行控制，以下是最小化**伪代码**

```html
<style>
  :root {
    --theme-color: rgb(31, 83, 255);
    // button
    --button-background-color: var(--theme-color);
    // link
    --link-text-color: var(--theme-color);
    // tag
    --tag-border-color: var(--theme-color);
    --tag-text-color: var(--theme-color);
  }
  button {
    background-color: var(--button-background-color);
    color: #fff;
    width: 100px;
    line-height: 30px;
    border: none;
    border-radius: 18px;
  }
  a {
    color: var(--link-text-color);
  }
  .tag {
    border: 1px solid var(--tag-border-color);
    color: var(--tag-text-color);
    cursor: pointer;
    padding: 2px 10px;
    border-radius: 8px;
  }
</style>
<script setup lang="ts">
  import { ref, watch } from 'vue'
  const currentColor = ref('#1f53ff')
  const setCssVar = (key: string, val: string) => {
    document.documentElement.style.setProperty(key, val)
  }
  watch(currentColor, (v) => {
    setCssVar('--theme-color', v)
  })
</script>
```

> 具体示例

[jcode](https://code.juejin.cn/pen/7289350212827480124)

## 最后

以上就是各个案例的最小化实现，项目中还需要针对性进行优化完善，比如我们还需要对缓存设置之后的主题，在下一次进入时依然还是同个等。

### 延迟加载示例

关于前面谈到的**延迟加载案例**，这里附上我之前博客改造时的一个小实现，主要时在编写 markdown 文章之后，需要对 markdown 的样式进行设置，类似掘金文章编辑器的切换
主题时的样子，只是把这个操作放到了前台来让用户自己可以操作显示什么样子的主题，主要通过安装`juejin-markdown-themes`这个包，里面包含一大堆 markdown 主题设置，通过`import.meta.glob`及其`import()`进行加载切换，大家如果觉得有兴趣可以实践一番，具体如图下

![blog.gif](https://raw.githubusercontent.com/CodeListener/resources/main/222.gif)
