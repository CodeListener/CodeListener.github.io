---
title: 浅析ElementUI Upload源码组件上传流程
date: 2024-01-27
tags: [Vue, Element]
category: 技术
summary: 很多时候我们都一直使用ElementUI的Upload上传组件进行二次封装， 但是否知道内部是什么样的一个上传流程，事件在哪个时机触发，从获取文...
---

> 很多时候我们都一直使用`ElementUI`的`Upload`上传组件进行二次封装， 但是否知道内部是什么样的一个上传流程，事件在哪个时机触发，从获取文件到上传结束究竟经历什么样的一个过程？希望通过分析该组件的核心逻辑 **(不包括UI逻辑)** 让你在后续的开发中能够快速定位问题所在

## 源文件

访问`packages/upload`目录可以看到如下内容,其主要核心代码在`upload.vue`和`index.vue`，单纯一个文件一个文件看代码理解虽然能看得懂，但是比较难把整个逻辑串通，所以我们从`文件的获取`到`上传结束`开始逐一分析

```bash
│  index.js
└─ src
    ajax.js              [默认上传请求工具]
    index.vue            [管理FileList数据，对外暴露操作文件列表的方法]
    upload-dragger.vue   [拖拽：对文件获取的逻辑]
    upload-list.vue      [文件列表：纯UI组件根据不同listType展示不同的样式]
    upload.vue           [对单个文件上传处理的过程]，会涉及index.vue文件逻辑操作]
```

## 流程图

![image.png](https://raw.githubusercontent.com/CodeListener/resources/main/20240811163717.png)

### 1️⃣. 获取文件

🗄️ **`upload.vue`**
<br>
创建input组件同时设置`display:none`进行隐藏，只通过`ref`进行引用触发`$refs.input.click()`,通过监听`(13: Enter键)` `32: (空格键)`和点击上传容器触发

1. `handleClick`
2. `handleKeydown`
3. `拖拽`(只是在拖拽结束获取文件触发uploadFiles，具体逻辑在upload-dragger.vue比较简单,所以不对其进行分析)

```js
methods: {
    handleClick() {
      if (!this.disabled) {
        // 处理选中文件之后，后续继续选中重复文件无法触发change问题
        this.$refs.input.value = null;
        this.$refs.input.click();
      }
    },
    handleKeydown(e) {
      if (e.target !== e.currentTarget) return;
      if (e.keyCode === 13 || e.keyCode === 32) {
        this.handleClick();
      }
    }
},
 render(h) {
    // ...
    const data = {
      on: {
        click: handleClick,
        keydown: handleKeydown
      }
    };
    return (
      <div {...data} tabindex="0" >
        // ...
        <input class="el-upload__input" type="file" ref="input" name={name} on-change={handleChange} multiple={multiple} accept={accept}></input>
      </div>
    );
  }
```

### 2️⃣. 文件个数校验

在触发input的`handleChange`后开始我们的**校验阶段**(`uploadFiles方法`)：

#### 📙 校验文件最大个数

**如果有设置`limit`个数限制时**，判断当前选中的文件和已有的文件总和是否超出最大个数，是的话则触发`onExceed事件`同时退出

```js
// 🗄️ upload.vue uploadFiles

if (this.limit && this.fileList.length + files.length > this.limit) {
  this.onExceed && this.onExceed(files, this.fileList)
  return
}
```

#### 📗 非多文件情况处理

如果`multiple`未设置或者为`false`时，只获取选中的第一个文件，如果没有选中的文件则退出

```js
// 🗄️ upload.vue uploadFiles

let postFiles = Array.prototype.slice.call(files)
if (!this.multiple) {
  postFiles = postFiles.slice(0, 1)
}
if (postFiles.length === 0) {
  return
}
```

### 3️⃣. 构造FileItem对象

```mermaid
graph LR
onStart --> handleStart
```

##### FileItem对象

| key        | 描述                                      |
| ---------- | ----------------------------------------- |
| status     | 文件状态: ready, uploading, success, fail |
| name       | 文件名称                                  |
| size       | 文件大小                                  |
| percentage | 上传进度                                  |
| uid        | 文件uid                                   |
| raw        | 原始文件对象                              |

遍历每一个选中的文件，根据我们需要的信息构建我们所的文件对象同时放入`fileList`数组中，同时`status`状态为`ready`准备上传阶段，判断如果`listType=picture-card | picture`根据文件设置url: 生成`blobURL`进行回显 (**不需要等待上传完成才能看到图片内容**), 接着触发`onChange`事件

```js
// upload.vue (onStart) ---> index.vue (handleStart)
handleStart(rawFile) {
  rawFile.uid = Date.now() + this.tempIndex++;
  let file = {
    status: 'ready',
    name: rawFile.name,
    size: rawFile.size,
    percentage: 0,
    uid: rawFile.uid,
    raw: rawFile
  };

  if (this.listType === 'picture-card' || this.listType === 'picture') {
    try {
      file.url = URL.createObjectURL(rawFile);
    } catch (err) {
      console.error('[Element Error][Upload]', err);
      return;
    }
  }

  this.uploadFiles.push(file);
  this.onChange(file, this.uploadFiles);
}
```

### 4️⃣. 上传阶段

紧接着判断`auto-upload`是否自动上传

- **true : 自动触发`upload`方法**
- **false: 通过外部手动触发`$refs.upload.submit()`**<br>
  手动触发时通过过滤出`status=ready`准备上传的文件遍历触发`upload`方法

```js
// index.vue
submit() {
  this.uploadFiles
    .filter(file => file.status === 'ready')
    .forEach(file => {
      this.$refs['upload-inner'].upload(file.raw);
    });
}
```

#### 🚥 beforeUpload前置操作

根据外部是否传入`beforeUpload`，可以对预备上传的文件进行预处理或者校验是否可以上传：

1. 不传`beforeUpload`直接触发`post`方法上传

```js
// 🗄️ upload.vue upload

if (!this.beforeUpload) {
  return this.post(rawFile)
}
```

2. 传`beforeUpload`(`同步`和`异步`)：
   - 同步：传入一个方法后返回false即终止上传，其他非Promise类型结果的都通过上传<br>
   - 异步：当被reject则中断上传过程，当`resolve`f返回一个新的文件或者Blob类型数据，根据原始的文件对象，重新构建出新的文件对象进行上传(resolve返回任意值都会触发上传)

```js
// 🗄️ upload.vue upload

const before = this.beforeUpload(rawFile)
// Promise
if (before && before.then) {
  before.then(
    (processedFile) => {
      const fileType = Object.prototype.toString.call(processedFile)
      if (fileType === '[object File]' || fileType === '[object Blob]') {
        if (fileType === '[object Blob]') {
          processedFile = new File([processedFile], rawFile.name, {
            type: rawFile.type,
          })
        }
        // 将原始值复制到新构建的File对象中
        for (const p in rawFile) {
          if (rawFile.hasOwnProperty(p)) {
            processedFile[p] = rawFile[p]
          }
        }
        this.post(processedFile)
      } else {
        this.post(rawFile)
      }
    },
    () => {
      // 停止上传并且从文件列表中删除
      this.onRemove(null, rawFile)
    },
  )
}
// 非false正常上传
else if (before !== false) {
  this.post(rawFile)
} else {
  // 停止上传并且从文件列表中删除
  this.onRemove(null, rawFile)
}
```

#### ⛔ beforeUpload中断情况

```mermaid
graph LR
onRemove --> handleRemove --> beforeRemove可选 --> doRemove
```

当`beforeUpload`返回`false`或者`reject`时，会触发`onRemove`方法(`index.vue: handleRemove`)

> ⚠️ 这里触发onRemove其实有个坑点，当你beforeUpload被中断时会触发onRemove对文件进行删除，如果你传入了beforeRemove同时弹出确认框确认删除操作，这会导致上传中断时显示出来，这会让用户感觉到突兀，有个比较粗糙的方式就是在beforeRemove判断status!=ready，即准备上传的文件不需要走beforeRemove确认直接删除

```js
 // index.vue
 handleRemove(file, raw) {
     if (raw) {
       // 获取当前的FileItem对象
       file = this.getFile(raw);
     }
     let doRemove = () => {
       // 中断正在上传的文件
       this.abort(file);
       // 移除当前FileItem
       let fileList = this.uploadFiles;
       fileList.splice(fileList.indexOf(file), 1);
       // 触发回调
       this.onRemove(file, fileList);
     };
     // 外部没有传入beforeRemove直接操作删除
     if (!this.beforeRemove) {
       doRemove();
     } else if (typeof this.beforeRemove === 'function') {
       const before = this.beforeRemove(file, this.uploadFiles);
       // 和 beforeUpload类似逻辑
       if (before && before.then) {
         before.then(() => {
           doRemove();
         }, noop);
       } else if (before !== false) {
         doRemove();
       }
     }
   }
```

#### 🚀 上传

```mermaid
graph LR
构造HttpRequest的Options参数 --> 发起请求并且缓存当前请求实例以便后续可终止
```

1. 构造参数，即`httpRequest`需要的请求对象 `options`<br>

| key             | 描述                 |
| --------------- | -------------------- |
| headers         | 请求headers          |
| withCredentials | 发送 cookie 凭证信息 |
| data            | 请求体数据           |
| filename        | 文件名称             |
| action          | 上传路径             |
| onProgress      | 上传进度回调         |
| onSuccess       | 上传成功回调         |
| onError         | 上传错误回调         |

当外部默认不传`httRequest`时，会通过内部封装的`ajax.js`进行上传请求(内部实现并没有说什么复杂的地方，单纯的实现原生`XMLHttpRequest`请求，这里就不对其内容进行讨论可自行了解)，需要注意的是当**自定义httpRequest**时，要对`onProgress`,`onSuccess`,`onError`进行回调，保证结果在内部能获取到正常响应

```js
// 🗄️ upload.vue post
// upload.vue post方法
const { uid } = rawFile
const options = {
  headers: this.headers,
  withCredentials: this.withCredentials,
  file: rawFile,
  data: this.data,
  filename: this.name,
  action: this.action,
  onProgress: (e) => {
    this.onProgress(e, rawFile)
  },
  onSuccess: (res) => {
    this.onSuccess(res, rawFile)
    delete this.reqs[uid]
  },
  onError: (err) => {
    this.onError(err, rawFile)
    delete this.reqs[uid]
  },
}
const req = this.httpRequest(options)
```

2. 缓存当前请求的每一个实例，同时在`http-request`的`options`内的`onSuccess`和`onError`回调时，对缓存的请求实例进行删除.<br>
   > ⚠️当你使用自定义`httpRequest`注意点：<br>
   >
   > 1. 有返回值时，记得暴露`abort`方法，因为内部默认ajax返回的实例是有`abort`方法可以中断请求，而如果自定义时返回没有`abort`方法时，点击删除会导致报错
   > 2. 需要在自定义httpRequest内部合理时机调用onSuccess,onProgress,onError,因为这是FileItem.status更新的时机

```js
this.reqs[uid] = req
if (req && req.then) {
  // 在最后触发成功之后，再次调用回调
  req.then(options.onSuccess, options.onError)
}
```

##### 🔵 Uploading

当触发`onProgress`回调时，对`FileItem`对象的`status`设置为`uploading`和`percentage`上传进度值，触发外部监听的`onProgress`回调

```js
// index.vue
handleProgress(ev, rawFile) {
  const file = this.getFile(rawFile);
  this.onProgress(ev, file, this.uploadFiles);
  file.status = 'uploading';
  file.percentage = ev.percent || 0;
}
```

##### 🟢 Success

当触发`onSuccess`回调时，对`FileItem`对象的`status`设置为`success`，添加`response`响应值 ,与此同时触发外部监听的`onSuccess`,`onChange`

```js
 handleSuccess(res, rawFile) {
  const file = this.getFile(rawFile);
  if (file) {
    file.status = 'success';
    file.response = res;

    this.onSuccess(res, file, this.uploadFiles);
    this.onChange(file, this.uploadFiles);
  }
}
```

##### 🔴 Fail

当触发`onError`回调时，对`FileItem`对象的`status`设置为`fail`，与此同时触发外部监听的`onError`,`onChange`，**当报错触发`handleError`会对相应报错的`FileItem`从`FileList`中移除**

```js
handleError(err, rawFile) {
  const file = this.getFile(rawFile);
  const fileList = this.uploadFiles;

  file.status = 'fail';

  fileList.splice(fileList.indexOf(file), 1);

  this.onError(err, file, this.uploadFiles);
  this.onChange(file, this.uploadFiles);
}
```

##### 🟠 Abort

由于组件对外提供了`abort`中断请求的方法，可以通过传入当前正上传的`file对象`或者文件的`uid`可中断指定的文件上传同时从`FileList`中移除,当不传任何参数时会对正在上传的全部文件进行中断

```js
// index.vue
// 对外暴露的方法
abort(file) {
      this.$refs['upload-inner'].abort(file);
},
// upload.vue
abort(file) {
  const { reqs } = this;
  // 传了指定文件
  if (file) {
    // 这里支持传入是一个uid
    let uid = file;
    if (file.uid) uid = file.uid;
    if (reqs[uid]) {
      // 将指定的请求进行中断
      reqs[uid].abort();
    }
  } else {
  // 不传参数则将正在上传的全部文件进行中断
    Object.keys(reqs).forEach((uid) => {
      if (reqs[uid]) reqs[uid].abort();
      delete reqs[uid];
    });
  }
}
```

### 事件触发时机图

![image.png](https://raw.githubusercontent.com/CodeListener/resources/main/20240811163825.png)

### 总结

以上就是对`Upload`组件上传流程的基本分析。不管是在对组件进行二次开发或者单独实现一个上传组件，希望你能够对其流程开发实现有更好的理解。
如果分析的不是很到位，希望能够在评论留下你的想法和意见，你的评价和点赞是我学习和输出的最大动力😃
