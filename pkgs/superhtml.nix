{
  lib,
  stdenv,
  fetchFromGitHub,
  zig_master,
}:

stdenv.mkDerivation rec {
  pname = "superhtml";
  version = "0.7.0";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "superhtml";
    rev = "v${version}";
    hash = "sha256-bbRqwIdSNgHTNsPZzn+pf/9ix02rT3BXRB6uszaPdi4=";
  };

  nativeBuildInputs = [
    zig_master
  ];

  buildPhase = "zig build --global-cache-dir .zig-cache -Doptimize=ReleaseFast";
  installPhase = "install -Dm755 zig-out/bin/superhtml -t $out/bin";

  meta = with lib; {
    description = "HTML Language Server & Templating Language Library";
    license = licenses.mit;
    maintainers = with maintainers; [ jaudiger ];
  };
}
