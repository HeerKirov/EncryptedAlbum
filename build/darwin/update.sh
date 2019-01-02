rm -rf target/Photos.app/Contents/Resources/app
mkdir target/Photos.app/Contents/Resources/app
cd ../..
cp package.json package-lock.json build/darwin/target/Photos.app/Contents/Resources/app/
cp -R target view view.css view.font view.js node_modules build/darwin/target/Photos.app/Contents/Resources/app/
cd - > /dev/null
rm -rf target/Photos.app/Contents/Resources/app/node_modules/typescript
rm -rf target/Photos.app/Contents/Resources/app/node_modules/electron/dist