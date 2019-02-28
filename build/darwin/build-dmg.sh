if [ -f "target/Hedge.dmg" ]; then
    rm "target/Hedge.dmg"
fi
npm -g install appdmg
appdmg files/dmg.json "target/Hedge.dmg"
echo Hedge.dmg build success.