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

mv target/Electron.app/Contents/MacOS/Electron target/Electron.app/Contents/MacOS/Photos
cp files/Info.plist target/Electron.app/Contents/Info.plist
cp files/photos.icns target/Electron.app/Contents/Resources/photos.icns
rm target/Electron.app/Contents/Resources/electron.icns

mkdir target/Electron.app/Contents/Resources/app
cd ../..
tsc
cp -R target view view.css view.font view.js package.json package-lock.json node_modules ./build/darwin/target/Electron.app/Contents/Resources/app/
cd - > /dev/null
rm -rf target/Electron.app/Contents/Reources/app/node_modules/typescript
rm -rf target/Electron.app/Contents/Reources/app/node_modules/electron/dist

mv target/Electron.app target/Photos.app

echo
echo Photos.app build success.