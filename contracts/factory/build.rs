use std::{
    fs::File,
    io::{BufRead, BufReader},
    path::PathBuf,
};

fn main() {
    sails_rs::build_wasm();

    let bin_path_file = File::open(".binpath").unwrap();
    let mut bin_path_reader = BufReader::new(bin_path_file);
    let mut bin_path = String::new();
    bin_path_reader.read_line(&mut bin_path).unwrap();

    let mut idl_path = PathBuf::from(bin_path);
    idl_path.set_extension("idl");
    sails_idl_gen::generate_idl_to_file::<factory_app::FactoryProgram>(idl_path).unwrap();
}
