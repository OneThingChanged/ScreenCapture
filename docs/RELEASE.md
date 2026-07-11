# 릴리즈 및 자동 업데이트

ScreenCapture는 `electron-updater`와 GitHub Releases를 사용한다. 설치된 NSIS 빌드는 아래 자산을 기준으로 업데이트를 확인한다.

- `latest.yml`: 최신 버전, 설치 파일명, SHA-512 해시
- `ScreenCapture-Setup-<version>-x64.exe`: 자동 업데이트 가능한 NSIS 설치본
- `ScreenCapture-Setup-<version>-x64.exe.blockmap`: 차등 다운로드 메타데이터
- `ScreenCapture-Portable-<version>-x64.exe`: 수동 실행용 portable 빌드(자동 업데이트 대상 아님)

업데이트 endpoint는 electron-builder가 패키지 안의 `app-update.yml`에 기록한다. 앱에서 `setFeedURL`을 직접 호출하지 않는다.

## 릴리즈 절차

1. `package.json`의 `version`을 올리고 lockfile을 동기화한다.
2. 검증 및 릴리즈 빌드를 실행한다.

```powershell
npm run typecheck
npm run release:build
```

3. 아래 산출물을 확인한다.

```text
dist/ScreenCapture-Setup-<version>-x64.exe
dist/ScreenCapture-Setup-<version>-x64.exe.blockmap
dist/ScreenCapture-Portable-<version>-x64.exe
dist/latest.yml
```

4. 소스 커밋과 `v<version>` 태그를 푸시한다.
5. GitHub Release를 draft/prerelease가 아닌 Latest로 게시하고 위 네 자산을 첨부한다.

```powershell
gh release create v<version> --latest `
  dist/ScreenCapture-Setup-<version>-x64.exe `
  dist/ScreenCapture-Setup-<version>-x64.exe.blockmap `
  dist/ScreenCapture-Portable-<version>-x64.exe `
  dist/latest.yml
```

## 주의 사항

- 자동 업데이트는 설치본(NSIS)에서만 동작한다. 개발 모드와 portable 빌드에서는 릴리즈 페이지를 통한 수동 업데이트를 사용한다.
- 릴리즈는 반드시 Latest로 게시해야 한다.
- 현재 Windows Authenticode 인증서가 없으므로 SmartScreen 경고가 표시될 수 있다. `latest.yml`의 SHA-512 검증과 코드 서명은 별개다.
- 이미 배포한 버전 번호로 파일을 교체하지 않는다. 수정 릴리즈는 항상 더 높은 버전으로 배포한다.
