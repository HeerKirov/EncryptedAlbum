if [ -f "target/Encrypted Album.dmg" ]; then
    rm "target/Encrypted Album.dmg"
fi
npm -g install appdmg
appdmg files/dmg.json "target/Encrypted Album.dmg"
echo Encrypted Album.dmg build success.