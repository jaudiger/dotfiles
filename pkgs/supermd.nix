{
  lib,
  stdenv,
  fetchFromGitHub,
  zig_master,
}:

stdenv.mkDerivation (finalAttrs: {
  pname = "supermd";
  version = "70e34739939e927dcef97288b57d30b24d221497";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "supermd";
    rev = finalAttrs.version;
    hash = "sha256-SDkNjhBSIMdMoPJQ/rEcEnG9NQgtpP5djoGJDBd+11U=";
  };

  zigDeps = zig_master.fetchDeps {
    inherit (finalAttrs) src pname version;
    fetchAll = true;
    hash = "sha256-0OokA7lP0ynjfUn1xXoB4LriB7BbrZogR1dMWF27wFM=";
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
    zig build "''${zigBuildFlags[@]}"
    runHook postBuild
  '';

  zigBuildFlags = [ "-Doptimize=ReleaseFast" ];

  installPhase = ''
    runHook preInstall
    install -Dm755 zig-out/bin/docgen -t "$out/bin"
    runHook postInstall
  '';

  meta = with lib; {
    description = "SuperMD is an extension of Markdown used by https://zine-ssg.io";
    license = licenses.mit;
    maintainers = with maintainers; [ jaudiger ];
  };
})
