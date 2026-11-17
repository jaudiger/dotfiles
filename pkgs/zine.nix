{
  lib,
  stdenv,
  fetchFromGitHub,
  zig,
}:

stdenv.mkDerivation (finalAttrs: {
  pname = "zine";
  version = "0.14.1";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "zine";
    rev = "v${finalAttrs.version}";
    hash = "sha256-nROe+jkm7t76iu9nXE5//ZAGHMStGxili7yvFE48emw=";
  };

  zigDeps = zig.fetchDeps {
    inherit (finalAttrs) src pname version;
    fetchAll = true;
    hash = "sha256-NHrOx6Ijk0/yl7KRW/WVB6P7+LSTH3o9JiSH2LtI0PY=";
  };

  nativeBuildInputs = [ zig ];

  preConfigure = ''
    export ZIG_GLOBAL_CACHE_DIR="$TMPDIR/zig-global-cache"
    mkdir -p "$ZIG_GLOBAL_CACHE_DIR"
  '';

  postConfigure = ''
    ln -s ${finalAttrs.zigDeps} "$ZIG_GLOBAL_CACHE_DIR/p"
  '';

  buildPhase = ''
    runHook preBuild
    zig build ${lib.escapeShellArgs finalAttrs.zigBuildFlags}
    runHook postBuild
  '';

  zigBuildFlags = [
    "-Doptimize=ReleaseFast"
    "-Dno-git-version"
    "-Dversion=${finalAttrs.version}"
  ];

  installPhase = ''
    runHook preInstall
    install -Dm755 zig-out/bin/zine -t "$out/bin"
    runHook postInstall
  '';

  meta = with lib; {
    description = "Fast, Scalable, Flexible Static Site Generator (SSG)";
    homepage = "https://github.com/kristoff-it/zine";
    license = licenses.mit;
    maintainers = with maintainers; [ jaudiger ];
  };
})
