{
  lib,
  buildNpmPackage,
  fetchurl,
  fetchzip,
  makeWrapper,
}:

let
  runtimeNode = fetchzip {
    url = "https://nodejs.org/dist/v24.20.0/node-v24.20.0-darwin-arm64.tar.gz";
    hash = "sha256-F9UVZf9MU+xzeIyWekw3+nntYSfbj5phU2cQMNjBcus=";
    stripRoot = true;
  };
in
buildNpmPackage rec {
  pname = "deepseek-harness";
  version = "0.1.7-rc.1";

  src = fetchurl {
    url = "https://registry.npmjs.org/@deepseek-ai/dsh/-/dsh-${version}.tgz";
    hash = "sha256-78f5GSOuXnvDWmVP2AqO7p027QWhQc5hCDlzGC14zUI=";
  };

  sourceRoot = "package";

  npmDepsHash = "sha256-fvqD1T2jtWHoTiLVWiRa8crmMhCVF+7fJ++A9fKcO/4=";

  nativeBuildInputs = [
    makeWrapper
  ];

  # Regenerate by extracting the npm tarball, removing devDependencies, and
  # running npm install --package-lock-only --omit=dev.
  postPatch = ''
    sed -i.bak \
      -e '/^  "devDependencies": {/,/^  }$/d' \
      -e '/^  "dependencies": {/,/^  },$/s/^  },$/  }/' \
      package.json
    rm package.json.bak
    cp ${./deepseek-harness-package-lock.json} package-lock.json
  '';

  npmInstallFlags = [
    "--omit=dev"
  ];

  dontNpmBuild = true;

  installPhase = ''
    runHook preInstall

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
}
