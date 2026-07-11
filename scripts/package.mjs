// @electron/packager 로 Windows 실행본을 생성한다 (코드서명 툴체인 불필요).
// electron-builder 의 NSIS 인스톨러는 winCodeSign 압축 해제에 심볼릭 링크 권한이
// 필요해 일반 사용자 환경에서 실패하므로, 서명이 필요 없는 packager 를 사용한다.
import { packager } from '@electron/packager'

const appPaths = await packager({
  dir: '.',
  name: 'ScreenCapture',
  platform: 'win32',
  arch: 'x64',
  out: 'dist-packager',
  overwrite: true,
  icon: 'resources/icon.ico',
  asar: {
    // ffmpeg 바이너리는 asar 밖으로 풀어야 실행 가능
    unpackDir: 'node_modules/ffmpeg-static'
  },
  ignore: [
    /^\/src/,
    /^\/dist/,
    /^\/dist-packager/,
    /^\/scripts/,
    /^\/\.vscode/,
    /^\/\.git/,
    /electron-builder\.yml/,
    /electron\.vite\.config/,
    /tsconfig.*\.json/
  ]
})

console.log('패키징 완료:', appPaths.join(', '))
