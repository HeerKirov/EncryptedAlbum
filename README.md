# Photos
编写中……

## 简介
一个普通的相册APP。功能上的主要特点：  
* 加密存储数据，依赖口令进行访问。
* 使用标签+集合模式管理图片库。
* 对pixiv访问的便捷功能。

## 技术
* `Electron` 这个程序的基础框架。
* `TypeScript` 核心功能代码使用TS。
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
```
运行：`npm start`  
带开发者工具的调试运行：`npm debug`

### 打包可执行程序
#### macOS
相关工具存放在`build/darwin`目录下。  
运行`build.sh`，以自动执行打包工作。    
打包后的程序的位置为`build/darwin/target/Photos.app`。

#### Windows
还没有做。自行构建参考[application-distribution](https://electronjs.org/docs/tutorial/application-distribution)。