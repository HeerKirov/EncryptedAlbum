ELECTRON_VERSION=v3.0.8

if [ -d "target" ]; then
    rm -rf target
fi
if [ -f "electron-$ELECTRON_VERSION-darwin-x64.zip" ]; then
    unzip electron-$ELECTRON_VERSION-darwin-x64.zip -d target
else
    wget https://github.com/electron/electron/releases/download/$ELECTRON_VERSION/electron-$ELECTRON_VERSION-darwin-x64.zip -O electron.zip
    unzip electron.zip -d target
    rm electron.zip
fi

mv target/Electron.app/Contents/MacOS/Electron "target/Electron.app/Contents/MacOS/Encrypted Album"
cp files/Info.plist target/Electron.app/Contents/Info.plist
cp files/album.icns target/Electron.app/Contents/Resources/album.icns
rm target/Electron.app/Contents/Resources/electron.icns

mkdir target/Electron.app/Contents/Resources/app
cd ../..
tsc
cp -R target view view.css view.font view.js node_modules ./build/darwin/target/Electron.app/Contents/Resources/app/
cp package.json package-lock.json ./build/darwin/target/Electron.app/Contents/Resources/app/
cd - > /dev/null
rm -rf target/Electron.app/Contents/Resources/app/node_modules/typescript
rm -rf target/Electron.app/Contents/Resources/app/node_modules/electron/dist
rm target/Electron.app/Contents/Resources/default_app.asar

mv target/Electron.app "target/Encrypted Album.app"
rm target/LICENSE*
rm target/version

echo
echo Encrypted Album.app build success.