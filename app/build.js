const builder = require('electron-builder');
const Platform = builder.Platform;

// Promise is returned
builder.build({
  targets: Platform.WINDOWS.createTarget(['nsis', 'appx']),
  config: {
    appId: 'com.yourcompany.yourapp',
    productName: 'DuoAI',
    directories: {
      output: 'dist'
    },
    // You can override any configuration from package.json here
    files: [
      "**/*",
      "!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}",
      "!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}",
      "!**/node_modules/*.d.ts",
      "!**/node_modules/.bin",
      "!dist",
      "!build",
      "!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}"
    ],
    win: {
      target: ["nsis", "appx"],
      icon: "build/icon.ico",
      publisherName: "Nicolas Reynolds",
      publisherDisplayName: "Nicolas Reynolds"
    },
    appx: {
      identityName: "NicolasReynolds.DuoAI",
      publisher: "CN=CC08B55D-3547-454B-8E21-F0E3A810C73C",
      publisherDisplayName: "DuoAI Technologies",
      applicationId: "DuoAI",
      backgroundColor: "#7e57c2",
      displayName: "DuoAI",
      showNameOnTiles: true,
      assets: {
        "Square44x44Logo": "build/appx/Square44x44Logo.png",
        "Square150x150Logo": "build/appx/Square150x150Logo.png",
        "Wide310x150Logo": "build/appx/Wide310x150Logo.png",
        "Square310x310Logo": "build/appx/Square310x310Logo.png",
        "StoreLogo": "build/appx/StoreLogo.png"
      }
    },
    mac: {
      target: ["dmg"],
      icon: "build/icon.icns"
    },
    linux: {
      target: ["AppImage"],
      icon: "build/icon.png"
    }
  }
})
  .then((result) => {
    console.log('Build completed successfully!');
    console.log(result);
  })
  .catch((error) => {
    console.error('Build failed:', error);
  });
