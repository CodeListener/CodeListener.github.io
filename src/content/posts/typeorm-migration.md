---
title: TypeORM 生产环境数据库迁移操作
date: 2024-08-15
tags: [nestjs, typeorm, mysql]
category: 技术
summary: TypeORM Migration 是一种用于数据库架构版本控制的工具。它允许你跟踪数据库结构的变化，并将这些变化应用到数据库中。Migration 文件包含了 SQL 查询，用于更新数据库架构并将新更改应用到现有数据库中,确保数据库结构的一致性和可追踪性。
---

> TypeORM Migration 是一种用于数据库架构版本控制的工具。它允许你跟踪数据库结构的变化，并将这些变化应用到数据库中。Migration 文件包含了 SQL 查询，用于更新数据库架构并将新更改应用到现有数据库中,确保数据库结构的一致性和可追踪性,下面我们来模拟实践一下

## 先前准备

准备好`article`实体及其`data-source.ts`文件 ，`data-source.ts`主要定义数据库相关的信息，`article`实体则是提供数据表的定义

- data-source.ts

```typescript
// data-source.ts
import { DataSource } from 'typeorm'
export const appDataSource = new DataSource({
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'xxxxxx',
  password: 'xxxxxx',
  database: 'blog',
  // 根据定义的路径自动读取全部entity实体文件
  entities: ['./src/**/*.entity.ts'],
  // 要为此连接加载迁移的文件
  migrations: ['./src/migrations/*.ts'],
  // 【注意】设置为false
  synchronize: false,
  logging: true,
})
```

- article.entity.ts

```typescript
// article.entity.ts
import { Category } from '../../category/entities/category.entity'
import { Tag } from '../../tag/entities/tag.entity'
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity()
export class Article {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  title: string

  @Column({
    nullable: true,
  })
  description?: string

  @Column({
    nullable: true,
  })
  banner?: string
  @Column({
    default: 0,
  })
  status?: number

  @Column()
  content: string

  @Column({
    default: 0,
  })
  read: number

  @CreateDateColumn({
    name: 'create_date',
  })
  createDate: Date

  @UpdateDateColumn({
    name: 'update_date',
  })
  updateDate: Date

  @Column({
    name: 'category_id',
  })
  categoryId: string

  @ManyToOne(() => Category, (category) => category.articles, {
    createForeignKeyConstraints: false,
    eager: true,
  })
  @JoinColumn({
    name: 'category_id',
  })
  category: Category
}
```

## 1. 创建migration文件

接下来我们创建migration文件，由于我们是手动执行，所以需要将`synchronize`设置为`false` 通过`TypeORM`提供的指令：

```shell
# 在src/migrations/目录下会生成一个文件
npx typeorm migration:create ./src/migrations/Article
```

运行该命令后，目录中看到一个名为{TIMESTAMP} -Article.ts的新文件，其中{TIMESTAMP}是生成迁移时的当前时间戳。 在文件内可以看到如下内容

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm'

export class Article1726727673416 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {}

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
```

up必须包含执行迁移所需的代码。 down必须恢复任何up改变。 down方法用于恢复上次迁移。
假设上线的时候由于线上没有该Article表，所以我们需要在 up内编创建该表，down则是对该创建的表进行撤回的执行SQL：

```typescript
export class Article1726727673416 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 创建表的sql
    await queryRunner.query(
      `CREATE TABLE \`article\` (
            \`id\` varchar(36) NOT NULL, 
            \`title\` varchar(255) NOT NULL, 
            \`description\` varchar(255) NULL, 
            \`banner\` varchar(255) NULL, 
            \`status\` int NOT NULL DEFAULT '0', 
            \`content\` varchar(255) NOT NULL, 
            \`read\` int NOT NULL DEFAULT '0', 
            \`create_date\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), 
            \`update_date\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), 
            \`category_id\` varchar(255) NOT NULL, 
            \`delete_flag\` int NOT NULL DEFAULT '0', PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    )
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    // 移除表的sql
    await queryRunner.query(`DROP TABLE \`article\``)
  }
}
```

## 2. 执行migration文件

上面我们编写了migration相关文件之后，只需要根据提供的指令执行，之后你可以在mysql中就会看到相关表的生成

```shell
npx typeorm migration:run -d ./src/data-source.ts
```

![article表](/3.png)

PS：如果你使用的是`typescript`那么会出现如下相关错误

![data-source错误](/2.png)

**解决方法如下：**

```shell
npx typeorm-ts-node-commonjs migration:run -d ./src/data-source.ts
```

## 3. 撤销已执行up方法

处于某种原因,你可能想要对线上已经执行过的sql变更进行撤销，由于我们已经在以生成的文件中的`down`方法编写了撤销的sql：

```typescript
public async down(queryRunner: QueryRunner): Promise<void> {
    // 移除表的sql
    await queryRunner.query(`DROP TABLE \`article\``);
}
```

你可以通过执行

```shell
npx typeorm-ts-node-commonjs  migration:revert -d ./src/data-source.ts
```

执行完成之后mysql的`article`表则将会被移除

## 3. 自动生成migration

前面我们在创建migration文件之后，会在里面编写相关数据库变更的更新/撤销sql,如果每次迭代都要去编写sql那属是挺麻烦的，这不，`TypeORM`为我们提供了相关自动生成更新/撤销的sql指令，减少我们的工作量：

```shell
 npx typeorm-ts-node-commonjs migration:generate ./src/migrations/Article  -d ./src/data-source.ts
```

执行完成之后将在目录下创建migration并为我们自动加上了执行sql，你可以将之前mysql中的`article`表删除，并重新执行migration即可

## 总结

以上就是我们在生产环境变更数据库的操作，具体使用到如下指令：
| 指令 | 说明 |
| ---------- | --------------------- |
| `migration:create` | 创建migration不包含需要执行的sql,需要自己编写 |
| `migration:run` | 执行migration文件中的up方法 |
| `migration:revert` | 执行migration文件的down方法 | `string` |
| `migration:generate` | 生成相关实体变更的migration文件 |

上面我们运行指令时都会加上`npx xxxxxxx`感觉命令还是挺长的，我们可以将其添加到`package.json`文件中的`script`脚本，再次缩短起运行指令的长度

```json
{
  "migration:create": "typeorm migration:create",
  "migration:run": "typeorm-ts-node-commonjs migration:run -d ./src/data-source.ts",
  "migration:revert": "typeorm-ts-node-commonjs migration:revert -d ./src/data-source.ts",
  "migration:generate": "typeorm-ts-node-commonjs migration:generate -d ./src/data-source.ts"
}
```

这样你就可以在终端上执行

```shell
npm run migration:create ./src/migrations/xxx
npm run migration:run
npm run migration:revert
npm run migration:generate ./src/migration/xxx
```

## FAQ

- Cannot find module '**\*\***'

![2022-08-02 09.52.36.gif](/1.png)

出现如上问题，是因为你的entity文件中引入其他相关文件路径出现了问题，比如我的`Article`需要关联`Category`的`entity`，所以我导入了该文件，`vscode`自动帮我生成了导入的代码行:

```typescript
// article.entity.ts
import { Category } from 'src/category/entities/category.entity'
```

由于ts无法识别该路径，所以这里我们需要将其调整如下:

```typescript
// article.entity.ts  改成相对路径
import { Category } from '../../category/entities/category.entity'
```

具体可参考[strackOverflow相关问题](https://stackoverflow.com/questions/66991600/typeorm-migration-error-cannot-find-module)
