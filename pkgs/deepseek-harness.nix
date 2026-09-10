{
  lib,
  buildNpmPackage,
  fetchurl,
  makeWrapper,
  nodejs,
}:

buildNpmPackage rec {
  pname = "deepseek-harness";
  version = "0.1.5-rc.1";

  src = fetchurl {
    url = "https://registry.npmjs.org/@deepseek-ai/dsh/-/dsh-${version}.tgz";
    hash = "sha256-Gnlxnxx2ORisMOgZTfeDqTMMaxLV8EyVBzGj+KHD2dA=";
  };

  sourceRoot = "package";

  npmDepsHash = "sha256-rjLkl2JwyqpvMySDCdR2pN2EoTHdcCPa8XLcQGw2ASA=";

  nativeBuildInputs = [
    makeWrapper
  ];

  # Regenerate by extracting the npm tarball, removing devDependencies, and running npm install --package-lock-only --omit=dev.
  postPatch = ''
    sed -i.bak \
      -e '/^  "devDependencies": {/,/^  }$/d' \
      -e '/^  "dependencies": {/,/^  },$/s/^  },$/  }/' \
      package.json
    rm package.json.bak
    cp ${./deepseek-harness-package-lock.json} package-lock.json
  '';

  npmInstallFlags = [ "--omit=dev" ];

  dontNpmBuild = true;

  installPhase = ''
    runHook preInstall

    mkdir -p "$out/lib/node_modules/@deepseek-ai/dsh" "$out/bin"
    cp -R . "$out/lib/node_modules/@deepseek-ai/dsh/"
    makeWrapper "${nodejs}/bin/node" "$out/bin/dsh" \
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
