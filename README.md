# Hedge
> version 0.2.1 Beta

版本日志：
1. 修复在打开对话框时切换页面的情况下，对话框底衬不会消失的bug。
2. 修复在设置页面的标签库搜索，如果搜索结果数为0，那么搜索框会消失的bug。
3. 修复标签的精准查找无效的bug。
4. 修正在重命名合并标签后，会在标签库内看到两个同名标签的bug。
5. 添加新的功能，允许修改标签类型的关键字，并允许关键字合并。

## 简介
一个普通的相册APP。功能上的主要特点：  
* 加密存储数据，依赖口令进行访问。
* 使用标签+集合模式管理图片库。
* 对pixiv访问的便捷功能。

## 技术
* `Electron` 这个程序的基础框架。
* `TypeScript` 编码语言。
* `Vue` 前端脚手架。
* `Bootstrap` 前端CSS框架。

## 构建
### 编译和调试
编译项目首先需要TypeScript。
```
npm install -g typescript
```
之后使用npm安装依赖和编译。
```
npm install
tsc

# 运行
npm start
  
# 调试运行(允许打开Chromium开发工具，并将storage目录设定在当前项目目录，而非AppData目录)
npm run debug
```

### 打包可执行程序
#### macOS
相关工具存放在`build/darwin`目录下。  
运行`build.sh`，以自动执行打包工作。打包后得到`build/darwin/target/Hedge.app`。  
运行`build-dmg.sh`，以执行将应用程序打包为镜像的工作。打包后得到`build.darwin/target/Hedge.dmg`。

#### Windows
自行构建参考[application-distribution](https://electronjs.org/docs/tutorial/application-distribution)。  