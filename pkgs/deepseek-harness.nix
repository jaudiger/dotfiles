{
  lib,
  fetchPnpmDeps,
  fetchurl,
  fetchzip,
  makeWrapper,
  pnpm_11,
  pnpmConfigHook,
  stdenvNoCC,
}:

let
  runtimeNode = fetchzip {
    url = "https://nodejs.org/dist/v24.20.0/node-v24.20.0-darwin-arm64.tar.gz";
    hash = "sha256-F9UVZf9MU+xzeIyWekw3+nntYSfbj5phU2cQMNjBcus=";
    stripRoot = true;
  };

  pnpmSourceFiles = ''
    cp ${./deepseek-harness-pnpm-lock.yaml} pnpm-lock.yaml
    cp ${./deepseek-harness-pnpm-workspace.yaml} pnpm-workspace.yaml
    cp ${./deepseek-harness-pi-ai-1.0.2.patch} patches-pi-ai.patch
  '';
in
stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "deepseek-harness";
  version = "0.2.1-alpha.2";

  src = fetchurl {
    url = "https://registry.npmjs.org/@deepseek-ai/dsh/-/dsh-${finalAttrs.version}.tgz";
    hash = "sha256-5MrTlEE9avk8wfq40ZjvmV4bp8vXvEM4bfXtfvS2ktA=";
  };

  sourceRoot = "package";

  pnpmInstallFlags = [ "--prod" ];

  pnpmDeps = fetchPnpmDeps {
    inherit (finalAttrs)
      pname
      version
      src
      sourceRoot
      pnpmInstallFlags
      ;
    pnpm = pnpm_11;
    fetcherVersion = 4;
    hash = "sha256-Sx/MGVZ0It3dKSv+HgIaW/TD9lyOSBFon88f4kEoO0A=";
    prePatch = pnpmSourceFiles;
  };

  nativeBuildInputs = [
    makeWrapper
    pnpm_11
    pnpmConfigHook
  ];

  postPatch = pnpmSourceFiles;

  dontBuild = true;

  installPhase = ''
    runHook preInstall

    rm pnpm-lock.yaml pnpm-workspace.yaml patches-pi-ai.patch
    mkdir -p "$out/lib/node_modules/@deepseek-ai/dsh" "$out/bin"
    cp -R . "$out/lib/node_modules/@deepseek-ai/dsh/"
    makeWrapper "${runtimeNode}/bin/node" "$out/bin/dsh" \
      --add-flags "--expose-internals" \
      --add-flags "$out/lib/node_modules/@deepseek-ai/dsh/lib/bin.js"

    runHook postInstall
  '';

  meta = {
    description = "DeepSeek Harness command-line agent runtime";
    homepage = "https://github.com/deepseek-ai/deepseek-harness";
    license = lib.licenses.mit;
    mainProgram = "dsh";
    maintainers = [ lib.maintainers.jaudiger ];
    platforms = lib.platforms.unix;
  };
})
