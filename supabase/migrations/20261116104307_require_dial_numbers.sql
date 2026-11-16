-- Every listing has a dial number now (seeded after 20261116103742_add_dial_numbers), so require it.
alter table businesses alter column dial_number set not null;
alter table residents alter column dial_number set not null;
