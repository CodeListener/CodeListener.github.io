---
title: 动动手你也能实现Github贡献日历图表
date: 2023-10-18
tags: [Vue]
category: 技术
summary: hello，掘友们好，许久不见。相信大家都有用过 github，每次我们在 github上的操作行为记录都会被记录到贡献日历图...
---

> hello，掘友们好，许久不见。相信大家都有用过 github，每次我们在 github上的操作行为记录都会被记录到贡献日历图，每天一点点的记录下来一整年回头看是不是觉得满满的成就感（虽然我很少操作哈哈哈）。不过刚好本人平时很喜欢跑步，已经坚持了将近三年，想着写个定时任务抓取下 keep 的每日跑步记录进行记录到个人网页，所以自己手写实现一下并记录成文章分享给大家

**[Github 仓库](https://github.com/CodeListener/contribution-calendar-chart)**

![image.png](https://raw.githubusercontent.com/CodeListener/resources/main/202408111619754.png)

## 使用技术

![t.png](https://raw.githubusercontent.com/CodeListener/resources/main/20240811162101.png)

## 实现步骤

我们以显示一年的期日来分析，一年最少 365 天，闰年最多 366 天，一年至少 52 周满天周且有余，所以我们可以得知总共有 53 列，本实现基于 table 标签进行实现，主要拆分为

- `head` 主要显示 `Months` 列，需要根据 `WeekRow` 集合来生成每一个月占多少列 `td` 设置 `colspan` 来列合并
- `body` 主要显示 `WeekRow` 每星期的每一天的行集合, 总共有七行

1.  静态 UI 编写,实现基础 UI
2.  生成每一行的日期方块，总共七行，每一行代表`星期一行日期集合 ~ 星期天行日期集合`
3.  最后根据日期方块生成月份列集合

那么我们现在开始吧：

> 以下主要讲解核心思路的具体实现，部分未讲解到的函数及其变量其实一看就明白，就不做讲解哈

## 静态 UI 编写

[jcode](https://code.juejin.cn/pen/7260293033449504779)
`body` 内容主要根据一个二维数组进行渲染(`DateItem\[]\[]`) 行表示每周的一天（第一行为星期天），列表示每周每一天的集合。但现在会发现，如果我用一整年的日期进行渲染，未必日期方块就是从星期天`(第1行第1列)`开始渲染，最后一天是星期六`(第7行第53列)`结束的呀。所以我们需要通过一定的逻辑来重新生成该集合

## 生成日期集合

创建一个生成日期集合相关函数,定义`getDateItems`函数来返回相关的日期集合

```typescript
// 一天的时间戳
const ONE_DAY_TIMESTAMP = 86400000
function getDateItems(start: string, end: string) {
  const startDate = new Date(start)
  const day = startDate.getDay()
  // 每行代表每周的星期几
  // 每列代表每周的星期几的日期集合
  const rows: DateItem[][] = [[], [], [], [], [], [], []]

  // 由于开始日期未必就是在第一行的第一列，我们可以获取开始日期是星期几
  // 遍历第一行第一列 到 开始日期的星期几 的日期加上ignore标识，方便渲染隐藏
  for (let i = 0; i < day; i++) {
    // 第一行第一列 到 开始日期
    const dateInfo = getDateInfo(startDate.getTime() - (day - i) * ONE_DAY_TIMESTAMP)
    rows[dateInfo.day].push({
      // 标识这一天实际上是不需要渲染的，我们只需要从开始日期开始渲染
      ignore: true,
      ...dateInfo,
    })
  }

  // 紧接对开始日期 到 结束日期进行遍历，将他们一一加入星期集合里面
  const endDate = new Date(end)
  for (
    let current = startDate.getTime();
    current <= endDate.getTime();
    current += ONE_DAY_TIMESTAMP
  ) {
    const dateInfo = getDateInfo(current)
    rows[dateInfo.day].push(dateInfo)
  }
  return rows
}
```

[jcode](https://code.juejin.cn/pen/7260310847528763411)

虽然我们是在实现一个生成一年内的所有日期集合，但我们并没有写死日期的固定范围，让它可根据外部传入的日期，能够让你按照自己的需范围需要进行生成

## 根据日期集合生成月集合

上面我们已经完成了最核心的日期集合生成，剩下的其实非常简单，现在我们根据日期集合生成月的集合，那为什么要用日期集合来生成呢？
因为我们还需要根据日期集合中，每一个月的天数总共占多少天，计算出日期集合中每一个月份占用多少列来设置 `td colspan` 属性。

这里重点需要注意的是

1.  上一年的**最后一个月份日期**和**今年的一月份日期**出现在**同一列**，我们直接把它累加到今年的一月份的`colspan`里；
2.  相同一年里，上一个月和下一个月日期出现在同一列，累加到上一个月

```typescript
function getMonthItems(rows: DateItem[][]) {
  // 收集每个月对象信息
  const result = new Map<string, { colspan: number; month: number; year: number }>()
  // 在上一个月份和下一个月份之前会出现在同一列
  // 我们情况区分：
  // 1. 上一年的最后一个月份日期和今年的一月份日期出现在同一列，我们直接把它累加到今年的一月份里
  // 2. 相同一年里，上一个月和下一个月日期出现在同一列，算入上一个月里

  // 情况1处理：根据第一列取出第一个和最后一个对比，是否是同年同月，不是的话计算入最后一个的日期月份里
  // 情况2不需要处理，默认遍历会计算入上一个月

  // 取出第一行和最后一行比较，并设置每一个月份列的信息
  const firstRow = rows[0]
  const lastRow = rows[rows.length - 1]
  firstRow.forEach((item, index) => {
    let curItem: DateItem = item
    // 存在同一列有上一年和今年的一月份的数据的情况，直接并入当前当年月份的colspan
    if (index === 0 && item.month !== lastRow[0].month) {
      curItem = lastRow[0]
    }
    const key = `${curItem.year}-${curItem.month}`
    // 每次遍历将目标月份取出进行累加colspan值
    const target = result.get(key) || {
      colspan: 0,
      month: curItem.month,
      year: curItem.year,
    }
    target.colspan++
    result.set(key, target)
  })
  return result.values()
}
```

[jcode](https://code.juejin.cn/pen/7261076996695064635)

## 实例完善

以上我们基本完成了核心逻辑的实现，现在我们可以自定义一个时间范围来生成任意的图表了，下面创建一个`主函数 generateChartData`来接收参数生成指定集合：

```typescript
// 不太懂typescript的童鞋可以直接看最后的函数主体
function generateChartData(): Result
function generateChartData(year: number): Result
function generateChartData(start: string | number | Date, end: string | number | Date): Result
function generateChartData(): Result
function generateChartData(year: number): Result
function generateChartData(start: string | number | Date, end: string | number | Date): Result
function generateChartData(...args: any): Result {
  let start: string
  let end: string
  // 一个参数时
  if (args.length === 1) {
    const [year] = args
    start = format(`${year}-01-01`)
    end = format(`${year}-12-31`)
  } else if (args.length === 2) {
    // 两个参数时
    ;[start, end] = [format(args[0]), format(args[1])]
  } else {
    // ❗
    // 默认不传或者传参超过2个，直接按默认处理
    // 默认情况下：当天为结束时间
    end = format(Date.now())
    // 根据结束时间反推开始时间
    start = format(getStartDate(end))
  }
  const dates = getDateItems(start, end)
  return {
    months: getMonthItems(dates),
    dates,
  }
}
```

这里我们实现几种传参个数区分实现返回内容：

1.  年份: `year`
2.  开始日期:`startDate` ，结束日期: `endDate`
3.  默认不传以当天为结束日期生成近期一年的日期集合

注意第 3 点，默认情况，我们不传参数希望今天为最后一天，渲染出近期的一年日期（github 默认显示的就是这样），所以我们以`当天`为`结束日期`, `开始日期`我们通过实现一个`getStartDate`来获取：

```typescript
// 根据结束日期来反推出开始日期
function getStartDate(end: number | string | Date) {
  // 52周
  const cols = 52
  const endDate = new Date(end)
  const day = endDate.getDay()
  // 由于一年365天, 365 / 7 > 52 && <53，所以只获取52周前的天数
  // 我们取第53列的第一天 减去 前面的52周的天数得出开始日期
  const endTimeStamp = endDate.getTime() - ONE_DAY_TIMESTAMP * day
  // 这里我们减去前面的52周得开始日期
  const diff = ONE_DAY_TIMESTAMP * cols * 7
  return new Date(endTimeStamp - diff)
}
```

这样我们就完成核心实现了，只需要将生成的数据遍历出来，这块内容具体我提交一个完整的仓库，方便掘友查看

**[Github 仓库](https://github.com/CodeListener/contribution-calendar-chart)**

## 最终实现效果

![image.png](https://raw.githubusercontent.com/CodeListener/resources/main/20230406230329.png)
