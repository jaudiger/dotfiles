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
    url = "https://nodejs.org/dist/v24.22.3/node-v24.22.3-darwin-arm64.tar.gz";
    hash = "sha256-5nPTfn01RR8vMB1EroPm1qzA3ybTc/NvpZyEctGl9Mo=";
    stripRoot = true;
  };

  pnpmSourceFiles = ''
    cp ${./deepseek-harness-pnpm-lock.yaml} pnpm-lock.yaml
    cp ${./deepseek-harness-pnpm-workspace.yaml} pnpm-workspace.yaml
    cp ${./deepseek-harness-pi-ai.patch} patches-pi-ai.patch
  '';
in
stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "deepseek-harness";
  version = "0.2.3-alpha.2";

  src = fetchurl {
    url = "https://registry.npmjs.org/@deepseek-ai/dsh/-/dsh-${finalAttrs.version}.tgz";
    hash = "sha256-mQB5Ogd/+myXlPc0nHxpEgzWok3sQWODenJWFn5h0lA=";
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
    hash = "sha256-MRKoS4LOZ5O3iL/YHdzxnMVgobhAa/Fkec2/H4xg1ys=";
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
