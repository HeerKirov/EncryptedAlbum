rm -rf "target/Encrypted Album.app/Contents/Resources/app"
mkdir "target/Encrypted Album.app/Contents/Resources/app"
cd ../..
cp package.json package-lock.json "build/darwin/target/Encrypted Album.app/Contents/Resources/app/"
cp -R target view view.css view.font view.js node_modules "build/darwin/target/Encrypted Album.app/Contents/Resources/app/"
cd - > /dev/null
rm -rf "target/Encrypted Album.app/Contents/Resources/app/node_modules/typescript"
rm -rf "target/Encrypted Album.app/Contents/Resources/app/node_modules/electron/dist"

echo
echo Encrypted Album.app update success.