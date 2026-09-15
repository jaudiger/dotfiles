{
  lib,
  stdenv,
  fetchFromGitHub,
  zig_master,
}:

stdenv.mkDerivation (finalAttrs: {
  pname = "zine";
  version = "0.14.0";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "zine";
    rev = "v${finalAttrs.version}";
    hash = "sha256-jY1jkYfvysFfxrYth4f26eU/TiE7HIp0Rxq9yvCA7fs=";
  };

  zigDeps = zig_master.fetchDeps {
    inherit (finalAttrs) src pname version;
    fetchAll = true;
    hash = "sha256-vcluHtnZlKqb8A/7iaChhTv0Qddod/B6DiMMmTS1Bcw=";
  };

  nativeBuildInputs = [ zig_master ];

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
