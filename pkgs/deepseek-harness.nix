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
  version = "0.1.6-alpha.2";

  src = fetchurl {
    url = "https://registry.npmjs.org/@deepseek-ai/dsh/-/dsh-${version}.tgz";
    hash = "sha256-o8FNF1wFECPc3gePsnOyh7E7S3dlTqkLUtlWy/QJF40=";
  };

  sourceRoot = "package";

  npmDepsHash = "sha256-TXQb17m9OEU0kB9LnZglmMzJt6DfMs0VKjrXVSdGZbw=";

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
