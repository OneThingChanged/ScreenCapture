# ScreenCapture

[English](../README.md)

ScreenCapture는 스크린샷, 화면 녹화, 미디어 관리 및 간단한 편집을 하나의 창에서 제공하는 Windows 데스크톱 앱입니다. Electron, React, TypeScript로 개발되었습니다.

## 주요 기능

- 캡처, 관리, 편집 탭으로 구성된 다크 테마 통합 작업 공간
- 영역, 창, 전체 화면 스크린샷
- 영역, 창, 전체 화면 MP4 녹화
- 보조키 조합을 지원하는 6개의 전역 단축키
- 고해상도 이미지를 원본 비율로 표시하고 커서에 맞는 도형 생성·선택·크기 조절과 `Ctrl+Z` 실행 취소를 지원하는 이미지 편집기
- 펜, 화살표, 사각형, 원, 텍스트, 모자이크, 색상, 굵기 도구
- 이미지 불러오기, 클립보드 복사, 다른 이름으로 저장
- 이미지 미리보기, 영상 재생, 스크롤, 검색, 이름 변경, 삭제, 파일 탐색기에서 보기를 제공하는 관리 탭
- 키보드 탐색, 삭제 프레임 `Ctrl+Z` 복원, GIF/MP4 내보내기를 지원하는 프레임 편집기
- 영상 압축
- 선택형 트레이 상주: 활성화하면 창을 닫아도 트레이에서 계속 실행하고, 비활성화하면 즉시 종료
- GitHub Releases 기반 업데이트 확인

## 기본 단축키

| 동작 | 단축키 |
| --- | --- |
| 영역 캡처 | `Ctrl+Shift+1` |
| 창 캡처 | `Ctrl+Shift+2` |
| 전체 화면 캡처 | `Ctrl+Shift+3` |
| 영역 녹화 | `Ctrl+Shift+4` |
| 창 녹화 | `Ctrl+Shift+5` |
| 전체 화면 녹화 | `Ctrl+Shift+R` |

설정에서 단축키를 변경할 수 있습니다. **변경** 버튼을 누른 다음 사용할 전체 키 조합을 입력하세요.

캡처 결과는 기본적으로 `사진\ScreenCapture` 폴더에 저장됩니다.

## 개발

```powershell
npm install
npm run dev
npm run typecheck
npm run build
```

## 패키징

```powershell
npm run pack            # 압축 해제 실행본
npm run pack:installer  # NSIS 설치본
npm run release:build   # NSIS 설치본, portable 실행본, blockmap, latest.yml
```

`electron-builder`가 Windows 서명 도구를 압축 해제할 때 심볼릭 링크 생성 권한을 요구할 수 있습니다. 이 단계에서 실패하면 Windows 개발자 모드를 켜거나 관리자 권한 터미널을 사용하세요. `npm run pack`은 코드 서명이 필요하지 않습니다.

릴리즈 및 자동 업데이트 절차는 [RELEASE.md](RELEASE.md)를 참고하세요. 릴리즈 제목과 본문은 영어로만 작성합니다.

## 프로젝트 구조

```text
src/
  main/          Electron 메인 프로세스, 캡처, 녹화, 트레이, 단축키, IPC, 저장
  preload/       contextIsolation 기반 렌더러 API
  renderer/app/  캡처, 관리, 편집 React 작업 공간
  renderer/      캡처 오버레이 및 숨김 녹화 렌더러
  shared/        공용 IPC 및 데이터 타입
resources/       앱 아이콘 및 아이콘 생성 스크립트
scripts/         패키징 스크립트
```

## 아이콘 재생성

```powershell
npm run icon
```
