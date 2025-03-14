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
      icon: "build/icon.ico",
      publisherName: "Nicolas Reynolds",
      publisherDisplayName: "Nicolas Reynolds",
      appx: {
        identityName: "NicolasReynolds.DuoAI",
        publisher: "CN=CC08B55D-3547-454B-8E21-F0E3A810C73C",
        publisherDisplayName: "DuoAI Technologies",
        applicationId: "DuoAI"
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
